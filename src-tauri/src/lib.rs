mod engine;

use engine::{AnalysisRequest, EngineStatus, UciEngineManager};
use tauri::{Manager, State};
use tauri_plugin_sql::{Migration, MigrationKind};

#[tauri::command]
async fn engine_initialize(
    app: tauri::AppHandle,
    manager: State<'_, UciEngineManager>,
) -> Result<EngineStatus, String> {
    manager.initialize(app).await
}

#[tauri::command]
async fn engine_analyze(
    app: tauri::AppHandle,
    request: AnalysisRequest,
    manager: State<'_, UciEngineManager>,
) -> Result<String, String> {
    manager.analyze(&app, request).await
}

#[tauri::command]
async fn engine_stop(
    app: tauri::AppHandle,
    job_id: Option<String>,
    manager: State<'_, UciEngineManager>,
) -> Result<(), String> {
    manager.stop(&app, job_id).await
}

#[tauri::command]
async fn engine_get_status(manager: State<'_, UciEngineManager>) -> Result<EngineStatus, String> {
    Ok(manager.status().await)
}

#[tauri::command]
async fn engine_restart(
    app: tauri::AppHandle,
    manager: State<'_, UciEngineManager>,
) -> Result<EngineStatus, String> {
    manager.restart(app).await
}

fn migrations() -> Vec<Migration> {
    vec![Migration {
        version: 1,
        description: "position_zero_initial_schema",
        kind: MigrationKind::Up,
        sql: r#"
          PRAGMA foreign_keys = ON;
          CREATE TABLE IF NOT EXISTS studies (
            id TEXT PRIMARY KEY,
            card_number INTEGER NOT NULL UNIQUE,
            title TEXT NOT NULL,
            source_type TEXT NOT NULL,
            source_game_id TEXT,
            account_id TEXT,
            root_fen TEXT NOT NULL,
            current_fen TEXT NOT NULL,
            original_pgn TEXT,
            move_tree TEXT NOT NULL DEFAULT '[]',
            notes TEXT NOT NULL DEFAULT '',
            tags TEXT NOT NULL DEFAULT '[]',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          );
          CREATE TABLE IF NOT EXISTS study_nodes (
            id TEXT PRIMARY KEY,
            study_id TEXT NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
            parent_id TEXT,
            fen TEXT NOT NULL,
            move_uci TEXT,
            san TEXT,
            comment TEXT NOT NULL DEFAULT '',
            sort_order INTEGER NOT NULL DEFAULT 0
          );
          CREATE TABLE IF NOT EXISTS analysis_cache (
            cache_key TEXT PRIMARY KEY,
            fen TEXT NOT NULL,
            engine_fingerprint TEXT NOT NULL,
            profile TEXT NOT NULL,
            multi_pv INTEGER NOT NULL,
            time_limit_ms INTEGER NOT NULL,
            lines TEXT NOT NULL,
            size_bytes INTEGER NOT NULL,
            created_at TEXT NOT NULL,
            accessed_at TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS analysis_cache_accessed ON analysis_cache(accessed_at);
          CREATE TABLE IF NOT EXISTS training_cards (
            id TEXT PRIMARY KEY,
            study_id TEXT NOT NULL REFERENCES studies(id) ON DELETE CASCADE,
            prompt_fen TEXT NOT NULL,
            accepted_moves TEXT NOT NULL,
            forcing_line TEXT NOT NULL,
            motif_tags TEXT NOT NULL,
            due_at TEXT NOT NULL,
            interval_days REAL NOT NULL DEFAULT 0,
            lapses INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS training_cards_due ON training_cards(due_at);
          CREATE TABLE IF NOT EXISTS review_log (
            id TEXT PRIMARY KEY,
            card_id TEXT NOT NULL REFERENCES training_cards(id) ON DELETE CASCADE,
            grade TEXT NOT NULL,
            reviewed_at TEXT NOT NULL,
            interval_days REAL NOT NULL
          );
          CREATE TABLE IF NOT EXISTS player_aliases (alias TEXT PRIMARY KEY, created_at TEXT NOT NULL);
          CREATE TABLE IF NOT EXISTS source_accounts (
            id TEXT PRIMARY KEY,
            provider TEXT NOT NULL,
            remote_user_id TEXT,
            display_name TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
          );
          CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
        "#,
    }]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .manage(UciEngineManager::default())
        .plugin(tauri_plugin_shell::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:position-zero.db", migrations())
                .build(),
        )
        .setup(|app| {
            #[cfg(target_os = "macos")]
            engine::install_power_observers(
                app.handle().clone(),
                app.state::<UciEngineManager>().inner().clone(),
            );
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            engine_initialize,
            engine_analyze,
            engine_stop,
            engine_get_status,
            engine_restart
        ])
        .build(tauri::generate_context!())
        .expect("error while running POSITION ZERO");
    app.run(|app_handle, event| {
        if matches!(
            event,
            tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit
        ) {
            app_handle
                .state::<UciEngineManager>()
                .terminate_now("POSITION ZERO is exiting.");
        }
    });
}
