use serde::{Deserialize, Serialize};
use std::{collections::BTreeMap, sync::Arc, time::Duration};
use tauri::{AppHandle, Emitter};
use tauri_plugin_shell::{
    process::{CommandChild, CommandEvent},
    ShellExt,
};
use tokio::sync::Mutex;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Wdl {
    pub win: u32,
    pub draw: u32,
    pub loss: u32,
}

#[derive(Debug, Clone, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisLine {
    pub rank: u32,
    pub score_cp: Option<i32>,
    pub mate_in: Option<i32>,
    pub wdl: Option<Wdl>,
    pub depth: u32,
    pub sel_depth: u32,
    pub nodes: u64,
    pub nps: u64,
    pub hash_full: u32,
    pub pv_uci: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisRequest {
    pub fen: String,
    pub profile: String,
    pub multi_pv: u32,
    pub time_limit_ms: u64,
    pub threads: Option<u32>,
    pub hash_mb: Option<u32>,
    pub depth: Option<u32>,
}

#[derive(Debug, Clone)]
struct QueuedAnalysis {
    job_id: String,
    request: AnalysisRequest,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineStatus {
    pub state: String,
    pub engine_name: Option<String>,
    pub current_job_id: Option<String>,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct InfoPayload {
    job_id: String,
    line: AnalysisLine,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct CompletePayload {
    job_id: String,
    best_move: Option<String>,
    lines: Vec<AnalysisLine>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ErrorPayload {
    job_id: Option<String>,
    message: String,
}

struct EngineInner {
    child: Option<CommandChild>,
    status: EngineStatus,
    lines: BTreeMap<u32, AnalysisLine>,
    queued: Option<QueuedAnalysis>,
}

impl Drop for EngineInner {
    fn drop(&mut self) {
        if let Some(mut child) = self.child.take() {
            let _ = child.write(b"quit\n");
            let _ = child.kill();
        }
    }
}

#[derive(Clone)]
pub struct UciEngineManager {
    inner: Arc<Mutex<EngineInner>>,
}

impl Default for UciEngineManager {
    fn default() -> Self {
        Self {
            inner: Arc::new(Mutex::new(EngineInner {
                child: None,
                status: EngineStatus {
                    state: "stopped".into(),
                    engine_name: None,
                    current_job_id: None,
                    message: None,
                },
                lines: BTreeMap::new(),
                queued: None,
            })),
        }
    }
}

impl UciEngineManager {
    pub async fn initialize(&self, app: AppHandle) -> Result<EngineStatus, String> {
        {
            let inner = self.inner.lock().await;
            if inner.child.is_some() {
                return Ok(inner.status.clone());
            }
        }

        let command = app
            .shell()
            .sidecar("stockfish")
            .map_err(|error| format!("Stockfish sidecar is unavailable: {error}"))?;
        let (mut receiver, mut child) = command
            .spawn()
            .map_err(|error| format!("Stockfish could not start: {error}"))?;
        child.write(b"uci\n").map_err(|error| error.to_string())?;

        {
            let mut inner = self.inner.lock().await;
            inner.status.state = "starting".into();
            inner.status.message = Some("Waiting for the UCI handshake…".into());
            inner.child = Some(child);
        }

        let manager = self.clone();
        let event_app = app.clone();
        tauri::async_runtime::spawn(async move {
            while let Some(event) = receiver.recv().await {
                match event {
                    CommandEvent::Stdout(bytes) => {
                        let output = String::from_utf8_lossy(&bytes);
                        for line in output.lines() {
                            manager.handle_stdout(&event_app, line.trim()).await;
                        }
                    }
                    CommandEvent::Stderr(bytes) => {
                        let message = String::from_utf8_lossy(&bytes).to_string();
                        let job_id = manager.inner.lock().await.status.current_job_id.clone();
                        let _ = event_app.emit("engine:error", ErrorPayload { job_id, message });
                    }
                    CommandEvent::Error(message) => {
                        let job_id = manager.inner.lock().await.status.current_job_id.clone();
                        let _ = event_app.emit("engine:error", ErrorPayload { job_id, message });
                    }
                    CommandEvent::Terminated(payload) => {
                        let mut inner = manager.inner.lock().await;
                        inner.child = None;
                        inner.status.state = "stopped".into();
                        inner.status.message =
                            Some(format!("Stockfish exited with {:?}.", payload.code));
                        let current = inner.status.current_job_id.take();
                        let queued = inner.queued.take().map(|analysis| analysis.job_id);
                        drop(inner);
                        for job_id in current.into_iter().chain(queued) {
                            let _ = event_app.emit(
                                "engine:error",
                                ErrorPayload {
                                    job_id: Some(job_id),
                                    message: "Stockfish stopped before analysis completed.".into(),
                                },
                            );
                        }
                    }
                    _ => {}
                }
            }
        });

        for _ in 0..100 {
            let status = self.status().await;
            if status.state == "ready" {
                return Ok(status);
            }
            if status.state == "error" || status.state == "stopped" {
                return Err(status
                    .message
                    .unwrap_or_else(|| "Stockfish stopped during startup.".into()));
            }
            tokio::time::sleep(Duration::from_millis(50)).await;
        }
        // A failed handshake must not leave a dead child in `inner.child`.
        // Otherwise every later initialize attempt incorrectly reports that
        // Stockfish is already running.
        let mut inner = self.inner.lock().await;
        if inner.status.state != "ready" {
            if let Some(mut child) = inner.child.take() {
                let _ = child.write(b"quit\n");
                let _ = child.kill();
            }
            inner.status.state = "stopped".into();
        }
        Err("Stockfish did not complete its UCI handshake within five seconds.".into())
    }

    pub async fn restart(&self, app: AppHandle) -> Result<EngineStatus, String> {
        self.terminate("Restarting Stockfish.").await;
        self.initialize(app).await
    }

    fn write(inner: &mut EngineInner, command: &str) -> Result<(), String> {
        let child = inner
            .child
            .as_mut()
            .ok_or_else(|| "Stockfish is not running.".to_string())?;
        child
            .write(format!("{command}\n").as_bytes())
            .map_err(|error| error.to_string())
    }

    fn start_locked(inner: &mut EngineInner, queued: &QueuedAnalysis) -> Result<(), String> {
        let (default_threads, default_hash) = match queued.request.profile.as_str() {
            "scan" => (4, 256),
            "deep" => (6, 512),
            _ => (2, 128),
        };
        let threads = queued
            .request
            .threads
            .unwrap_or(default_threads)
            .clamp(1, 16);
        let hash = queued
            .request
            .hash_mb
            .unwrap_or(default_hash)
            .clamp(16, 4096);
        Self::write(inner, &format!("setoption name Threads value {threads}"))?;
        Self::write(inner, &format!("setoption name Hash value {hash}"))?;
        Self::write(
            inner,
            &format!(
                "setoption name MultiPV value {}",
                queued.request.multi_pv.clamp(1, 5)
            ),
        )?;
        Self::write(inner, &format!("position fen {}", queued.request.fen))?;
        inner.lines.clear();
        inner.status.current_job_id = Some(queued.job_id.clone());
        inner.status.state = "thinking".into();
        if let Some(depth) = queued.request.depth.filter(|depth| *depth > 0) {
            Self::write(inner, &format!("go depth {}", depth.clamp(1, 99)))
        } else {
            Self::write(
                inner,
                &format!("go movetime {}", queued.request.time_limit_ms.max(50)),
            )
        }
    }

    fn finish_current(
        inner: &mut EngineInner,
    ) -> Option<(String, Vec<AnalysisLine>, Option<QueuedAnalysis>)> {
        let job_id = inner.status.current_job_id.take()?;
        let lines = inner.lines.values().cloned().collect();
        let queued = inner.queued.take();
        Some((job_id, lines, queued))
    }

    async fn handle_stdout(&self, app: &AppHandle, line: &str) {
        if let Some(name) = line.strip_prefix("id name ") {
            self.inner.lock().await.status.engine_name = Some(name.to_string());
            return;
        }
        if line == "uciok" {
            let mut inner = self.inner.lock().await;
            let _ = Self::write(&mut inner, "setoption name UCI_ShowWDL value true");
            let _ = Self::write(&mut inner, "isready");
            return;
        }
        if line == "readyok" {
            let mut inner = self.inner.lock().await;
            inner.status.state = "ready".into();
            inner.status.message = None;
            return;
        }
        if let Some(parsed) = parse_info_line(line) {
            let mut inner = self.inner.lock().await;
            if let Some(job_id) = inner.status.current_job_id.clone() {
                inner.lines.insert(parsed.rank, parsed.clone());
                let _ = app.emit(
                    "engine:info",
                    InfoPayload {
                        job_id,
                        line: parsed,
                    },
                );
            }
            return;
        }
        if let Some(rest) = line.strip_prefix("bestmove ") {
            let best = rest
                .split_whitespace()
                .next()
                .filter(|value| *value != "(none)")
                .map(str::to_string);
            let mut inner = self.inner.lock().await;
            if let Some((job_id, lines, queued)) = Self::finish_current(&mut inner) {
                let start_error = queued.as_ref().and_then(|next| {
                    Self::start_locked(&mut inner, next)
                        .err()
                        .map(|message| (next.job_id.clone(), message))
                });
                if queued.is_none() {
                    inner.status.state = "ready".into();
                } else if start_error.is_some() {
                    inner.status.state = "error".into();
                }
                drop(inner);
                let _ = app.emit(
                    "engine:complete",
                    CompletePayload {
                        job_id,
                        best_move: best,
                        lines,
                    },
                );
                if let Some((job_id, message)) = start_error {
                    let _ = app.emit(
                        "engine:error",
                        ErrorPayload {
                            job_id: Some(job_id),
                            message,
                        },
                    );
                }
            }
        }
    }

    pub async fn analyze(
        &self,
        app: &AppHandle,
        request: AnalysisRequest,
    ) -> Result<String, String> {
        if request.fen.split_whitespace().count() != 6 {
            return Err("Analysis requires a complete six-field FEN.".into());
        }
        let job_id = Uuid::new_v4().to_string();
        let queued = QueuedAnalysis {
            job_id: job_id.clone(),
            request,
        };
        let mut inner = self.inner.lock().await;
        if inner.child.is_none() {
            return Err("Stockfish is not initialized.".into());
        }
        if inner.status.current_job_id.is_some() {
            Self::write(&mut inner, "stop")?;
            let superseded = inner.queued.replace(queued);
            drop(inner);
            if let Some(previous) = superseded {
                let _ = app.emit(
                    "engine:error",
                    ErrorPayload {
                        job_id: Some(previous.job_id),
                        message: "Analysis was superseded before it started.".into(),
                    },
                );
            }
            return Ok(job_id);
        }
        Self::start_locked(&mut inner, &queued)?;
        Ok(job_id)
    }

    pub async fn stop(&self, app: &AppHandle, job_id: Option<String>) -> Result<(), String> {
        let mut inner = self.inner.lock().await;
        let cancel_queued = job_id.is_none()
            || inner
                .queued
                .as_ref()
                .is_some_and(|queued| Some(&queued.job_id) == job_id.as_ref());
        let cancelled = cancel_queued.then(|| inner.queued.take()).flatten();
        let matches = job_id.is_none() || job_id == inner.status.current_job_id;
        if matches && inner.status.current_job_id.is_some() {
            Self::write(&mut inner, "stop")?;
        }
        drop(inner);
        if let Some(cancelled) = cancelled {
            let _ = app.emit(
                "engine:error",
                ErrorPayload {
                    job_id: Some(cancelled.job_id),
                    message: "Analysis was cancelled before it started.".into(),
                },
            );
        }
        Ok(())
    }

    fn terminate_locked(inner: &mut EngineInner, message: &str) -> Vec<String> {
        let mut jobs = Vec::new();
        if let Some(job_id) = inner.status.current_job_id.take() {
            jobs.push(job_id);
        }
        if let Some(queued) = inner.queued.take() {
            jobs.push(queued.job_id);
        }
        if let Some(mut child) = inner.child.take() {
            let _ = child.write(b"quit\n");
            let _ = child.kill();
        }
        inner.lines.clear();
        inner.status.state = "stopped".into();
        inner.status.message = Some(message.into());
        jobs
    }

    /// Async-safe termination for commands and notification handlers running
    /// on Tokio worker threads. Never use `blocking_lock` from those paths.
    pub async fn terminate(&self, message: &str) -> Vec<String> {
        let mut inner = self.inner.lock().await;
        Self::terminate_locked(&mut inner, message)
    }

    /// Synchronous termination reserved for Tauri's synchronous exit callback
    /// and Drop, where no async runtime worker is being blocked.
    pub fn terminate_now(&self, message: &str) -> Vec<String> {
        let mut inner = self.inner.blocking_lock();
        Self::terminate_locked(&mut inner, message)
    }

    pub async fn status(&self) -> EngineStatus {
        self.inner.lock().await.status.clone()
    }
}

#[cfg(target_os = "macos")]
pub fn install_power_observers(app: AppHandle, manager: UciEngineManager) {
    use block2::RcBlock;
    use objc2_app_kit::{
        NSWorkspace, NSWorkspaceDidWakeNotification, NSWorkspaceWillPowerOffNotification,
        NSWorkspaceWillSleepNotification,
    };
    use objc2_foundation::NSNotification;
    use std::{mem, ptr::NonNull};

    let center = NSWorkspace::sharedWorkspace().notificationCenter();
    let sleep_app = app.clone();
    let sleep_manager = manager.clone();
    let stop_block = RcBlock::new(move |_notification: NonNull<NSNotification>| {
        let manager = sleep_manager.clone();
        let app = sleep_app.clone();
        tauri::async_runtime::spawn(async move {
            for job_id in manager
                .terminate("Stockfish paused for system sleep.")
                .await
            {
                let _ = app.emit(
                    "engine:error",
                    ErrorPayload {
                        job_id: Some(job_id),
                        message: "Analysis stopped because the Mac is going to sleep.".into(),
                    },
                );
            }
        });
    });
    let wake_manager = manager;
    let wake_app = app;
    let wake_block = RcBlock::new(move |_notification: NonNull<NSNotification>| {
        let manager = wake_manager.clone();
        let app = wake_app.clone();
        tauri::async_runtime::spawn(async move {
            let _ = manager.initialize(app).await;
        });
    });

    unsafe {
        let sleep_observer = center.addObserverForName_object_queue_usingBlock(
            Some(NSWorkspaceWillSleepNotification),
            None,
            None,
            &stop_block,
        );
        let power_off_observer = center.addObserverForName_object_queue_usingBlock(
            Some(NSWorkspaceWillPowerOffNotification),
            None,
            None,
            &stop_block,
        );
        let wake_observer = center.addObserverForName_object_queue_usingBlock(
            Some(NSWorkspaceDidWakeNotification),
            None,
            None,
            &wake_block,
        );
        // NSWorkspace's notification center owns these observers for the
        // application lifetime. Keeping the returned tokens alive avoids
        // unregistering them while the app is running.
        mem::forget(sleep_observer);
        mem::forget(power_off_observer);
        mem::forget(wake_observer);
    }
}

pub fn parse_info_line(line: &str) -> Option<AnalysisLine> {
    if !line.starts_with("info ") || !line.contains(" pv ") {
        return None;
    }
    let tokens: Vec<&str> = line.split_whitespace().collect();
    let mut parsed = AnalysisLine {
        rank: 1,
        score_cp: None,
        mate_in: None,
        wdl: None,
        depth: 0,
        sel_depth: 0,
        nodes: 0,
        nps: 0,
        hash_full: 0,
        pv_uci: Vec::new(),
    };
    let mut index = 1;
    while index < tokens.len() {
        match tokens[index] {
            "depth" => parsed.depth = parse_next(&tokens, index),
            "seldepth" => parsed.sel_depth = parse_next(&tokens, index),
            "multipv" => parsed.rank = parse_next(&tokens, index),
            "nodes" => parsed.nodes = parse_next(&tokens, index),
            "nps" => parsed.nps = parse_next(&tokens, index),
            "hashfull" => parsed.hash_full = parse_next(&tokens, index),
            "score" if tokens.get(index + 1) == Some(&"cp") => {
                parsed.score_cp = tokens.get(index + 2).and_then(|value| value.parse().ok());
                index += 2;
            }
            "score" if tokens.get(index + 1) == Some(&"mate") => {
                parsed.mate_in = tokens.get(index + 2).and_then(|value| value.parse().ok());
                index += 2;
            }
            "wdl" => {
                parsed.wdl = Some(Wdl {
                    win: parse_next(&tokens, index),
                    draw: tokens
                        .get(index + 2)
                        .and_then(|value| value.parse().ok())
                        .unwrap_or(0),
                    loss: tokens
                        .get(index + 3)
                        .and_then(|value| value.parse().ok())
                        .unwrap_or(0),
                });
                index += 3;
            }
            "pv" => {
                parsed.pv_uci = tokens[index + 1..]
                    .iter()
                    .map(|value| (*value).to_string())
                    .collect();
                break;
            }
            _ => {}
        }
        index += 1;
    }
    (!parsed.pv_uci.is_empty()).then_some(parsed)
}

fn parse_next<T: std::str::FromStr + Default>(tokens: &[&str], index: usize) -> T {
    tokens
        .get(index + 1)
        .and_then(|value| value.parse().ok())
        .unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_centipawn_wdl_and_pv() {
        let line = parse_info_line("info depth 18 seldepth 25 multipv 2 score cp -34 wdl 110 710 180 nodes 123456 nps 800000 hashfull 42 pv e2e4 e7e5").unwrap();
        assert_eq!(line.rank, 2);
        assert_eq!(line.score_cp, Some(-34));
        assert_eq!(line.wdl.unwrap().draw, 710);
        assert_eq!(line.pv_uci, vec!["e2e4", "e7e5"]);
    }

    #[test]
    fn parses_mate_score() {
        let line = parse_info_line("info depth 20 score mate 3 nodes 10 pv h7h8q").unwrap();
        assert_eq!(line.mate_in, Some(3));
        assert_eq!(line.pv_uci, vec!["h7h8q"]);
    }

    #[test]
    fn completing_a_stopped_job_keeps_the_replacement_separate() {
        let replacement = QueuedAnalysis {
            job_id: "new-job".into(),
            request: AnalysisRequest {
                fen: "8/8/8/8/8/8/4K3/7k w - - 0 1".into(),
                profile: "quick".into(),
                multi_pv: 3,
                time_limit_ms: 1_000,
                threads: None,
                hash_mb: None,
                depth: None,
            },
        };
        let mut inner = EngineInner {
            child: None,
            status: EngineStatus {
                state: "thinking".into(),
                engine_name: Some("Stockfish 18".into()),
                current_job_id: Some("old-job".into()),
                message: None,
            },
            lines: BTreeMap::new(),
            queued: Some(replacement),
        };

        let (completed, _, queued) = UciEngineManager::finish_current(&mut inner).unwrap();
        assert_eq!(completed, "old-job");
        assert_eq!(queued.unwrap().job_id, "new-job");
        assert!(inner.status.current_job_id.is_none());
    }
}
