import { useEffect, useMemo, useRef, useState } from "react";
import { Chess, type Square } from "chess.js";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { CLASSIC_MODEL_URL, CLASSIC_PIECE_NODES, boardCameraFov, legalBoardMove, squarePosition } from "../lib/board3d";
import type { ChessBoardProps } from "./ChessBoard";

type View = { update: () => void; reset: () => void };
type Props = ChessBoardProps & { onFallback: () => void };
const PIECE_NAMES = { k: "king", q: "queen", b: "bishop", n: "knight", r: "rook", p: "pawn" };

export function ChessBoard3D(props: Props) {
  const { fen, orientation = "w", disabled = false, onMove, onFallback } = props;
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<View | null>(null);
  const [selection, setSelection] = useState<{ fen: string; square: Square } | null>(null);
  const selected = selection?.fen === fen ? selection.square : null;
  const [status, setStatus] = useState("正在加载本地 3D 棋子…");
  const [failed, setFailed] = useState(false);
  const [hovered, setHovered] = useState("");
  const chess = useMemo(() => new Chess(fen), [fen]);
  const squares = useMemo(() => {
    const files = orientation === "w" ? "abcdefgh" : "hgfedcba";
    const ranks = orientation === "w" ? "87654321" : "12345678";
    return [...ranks].flatMap(rank => [...files].map(file => `${file}${rank}` as Square));
  }, [orientation]);
  const targets = selected ? chess.moves({ square: selected, verbose: true }).map(move => move.to) : [];

  function choose(square: Square) {
    if (disabled) return;
    if (selected && legalBoardMove(fen, selected, square)) {
      try {
        if (onMove?.(selected, square) !== false) setSelection(null);
      } catch { setSelection(null); }
    } else {
      setSelection(chess.get(square)?.color === chess.turn() ? { fen, square } : null);
    }
  }

  // The WebGL lifecycle remains stable while moves and engine overlays change.
  const live = useRef({ props, selected, targets, choose });
  live.current = { props, selected, targets, choose };

  useEffect(() => {
    const element = host.current!;
    let renderer: THREE.WebGLRenderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false }); }
    catch {
      setFailed(true);
      setStatus("此设备无法启动 WebGL，仍可使用 2D 棋盘。");
      return;
    }
    let disposed = false;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.95;
    renderer.domElement.setAttribute("aria-label", "3D chess position. Drag to orbit, scroll to zoom.");
    renderer.domElement.setAttribute("role", "img");
    element.append(renderer.domElement);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#e7e8e8");
    const camera = new THREE.PerspectiveCamera(37, 1, 0.1, 100);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enablePan = false;
    controls.minDistance = 12;
    controls.maxDistance = 24;
    controls.minPolarAngle = 0.18;
    controls.maxPolarAngle = Math.PI / 2.8;
    controls.target.set(0, 0.2, 0);
    const render = () => { if (!disposed) renderer.render(scene, camera); };
    const reset = () => {
      const side = live.current.props.orientation === "b" ? -1 : 1;
      camera.position.set(1.8 * side, 12.8, 13.8 * side);
      controls.target.set(0, 0.2, 0);
      controls.update();
      render();
    };
    controls.addEventListener("change", render);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x5e6570, 2.1));
    const light = new THREE.DirectionalLight(0xffffff, 3);
    light.position.set(-4, 10, 6);
    light.castShadow = true;
    light.shadow.mapSize.set(2048, 2048);
    Object.assign(light.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 0.5, far: 30 });
    light.shadow.bias = -0.0005;
    light.shadow.normalBias = 0.035;
    scene.add(light);
    const rim = new THREE.DirectionalLight(0xc9ddff, 1.5);
    rim.position.set(5, 4, -6);
    scene.add(rim);

    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>();
    function material(color: string, roughness = 0.55) {
      const result = new THREE.MeshStandardMaterial({ color, roughness });
      materials.add(result);
      return result;
    }
    const ivory = material("#e8e3d8", 0.32);
    const ebony = material("#202329", 0.3);
    const lightTile = material("#eeeae1");
    const darkTile = material("#555c65");
    const tileGeometry = new THREE.BoxGeometry(1, 0.08, 1);
    geometries.add(tileGeometry);
    const tiles: THREE.Mesh[] = [];
    const pickable: THREE.Object3D[] = [];
    for (let rank = 1; rank <= 8; rank++) for (const file of "abcdefgh") {
      const square = `${file}${rank}` as Square;
      const dark = ((file.charCodeAt(0) - 97) + rank) % 2 === 1;
      const tile = new THREE.Mesh(tileGeometry, dark ? darkTile : lightTile);
      tile.position.set(...squarePosition(square));
      tile.position.y = -0.04;
      tile.receiveShadow = true;
      tile.userData.square = square;
      tiles.push(tile);
      pickable.push(tile);
      scene.add(tile);
    }
    const baseGeometry = new THREE.BoxGeometry(8.8, 0.32, 8.8);
    geometries.add(baseGeometry);
    const base = new THREE.Mesh(baseGeometry, material("#252a30", 0.45));
    base.position.y = -0.24;
    base.receiveShadow = true;
    scene.add(base);

    function label(text: string, x: number, z: number, rotation = 0) {
      const canvas = document.createElement("canvas");
      canvas.width = 128; canvas.height = 128;
      const context = canvas.getContext("2d")!;
      context.fillStyle = "#e7e8e8";
      context.font = "600 74px sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(text, 64, 66);
      const texture = new THREE.CanvasTexture(canvas);
      texture.colorSpace = THREE.SRGBColorSpace;
      textures.add(texture);
      const mat = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false });
      materials.add(mat);
      const geometry = new THREE.PlaneGeometry(0.25, 0.25);
      geometries.add(geometry);
      const mesh = new THREE.Mesh(geometry, mat);
      mesh.rotation.set(-Math.PI / 2, 0, rotation);
      mesh.position.set(x, -0.071, z);
      scene.add(mesh);
    }
    for (let index = 0; index < 8; index++) {
      label("ABCDEFGH"[index], index - 3.5, 4.22);
      label("ABCDEFGH"[index], index - 3.5, -4.22, Math.PI);
      label(String(8 - index), -4.22, index - 3.5);
      label(String(8 - index), 4.22, index - 3.5, Math.PI);
    }
    const pieces = new THREE.Group();
    const overlays = new THREE.Group();
    scene.add(pieces, overlays);
    const prototypes: Partial<Record<keyof typeof CLASSIC_PIECE_NODES, THREE.Object3D>> = {};
    const overlayGeometry = new THREE.PlaneGeometry(0.93, 0.93);
    geometries.add(overlayGeometry);
    const selectedMaterial = new THREE.MeshBasicMaterial({ color: "#d6ad50", transparent: true, opacity: 0.68, depthWrite: false });
    const evidenceMaterial = new THREE.MeshBasicMaterial({ color: "#4a9ead", transparent: true, opacity: 0.38, depthWrite: false });
    const targetMaterial = new THREE.MeshBasicMaterial({ color: "#d6ad50", transparent: true, opacity: 0.85, depthWrite: false });
    [selectedMaterial, evidenceMaterial, targetMaterial].forEach(mat => materials.add(mat));
    const targetGeometry = new THREE.CircleGeometry(0.11, 24);
    geometries.add(targetGeometry);
    const shaftGeometry = new THREE.CylinderGeometry(0.035, 0.035, 1, 8);
    const headGeometry = new THREE.ConeGeometry(0.15, 0.35, 12);
    geometries.add(shaftGeometry); geometries.add(headGeometry);
    function mark(square: string, mat: THREE.Material, geometry: THREE.BufferGeometry = overlayGeometry) {
      const mesh = new THREE.Mesh(geometry, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(...squarePosition(square));
      mesh.position.y = 0.006;
      overlays.add(mesh);
    }
    function update() {
      pieces.clear(); overlays.clear();
      pickable.splice(64);
      const { props: current, selected: selection, targets: moves } = live.current;
      const position = new Chess(current.fen);
      for (const row of position.board()) for (const piece of row) {
        if (!piece || !prototypes[piece.type]) continue;
        const object = prototypes[piece.type]!.clone(true);
        object.position.set(...squarePosition(piece.square));
        if (piece.color === "b") object.rotation.y = Math.PI;
        object.traverse(child => {
          child.userData.square = piece.square;
          if (child instanceof THREE.Mesh) {
            child.material = piece.color === "w" ? ivory : ebony;
            child.castShadow = true; child.receiveShadow = true;
            pickable.push(child);
          }
        });
        pieces.add(object);
      }
      if (selection) mark(selection, selectedMaterial);
      for (const square of moves) mark(square, targetMaterial, targetGeometry);
      for (const square of current.evidenceSquares ?? []) mark(square, evidenceMaterial);
      for (const arrow of current.arrows ?? []) {
        const start = new THREE.Vector3(...squarePosition(arrow.from));
        const end = new THREE.Vector3(...squarePosition(arrow.to));
        start.y = end.y = 0.025;
        const delta = end.sub(start);
        const length = delta.length() - 0.2;
        const arrowGroup = new THREE.Group();
        const shaft = new THREE.Mesh(shaftGeometry, targetMaterial);
        shaft.scale.y = length - 0.35; shaft.position.y = (length - 0.35) / 2;
        const head = new THREE.Mesh(headGeometry, targetMaterial);
        head.position.y = length - 0.175;
        arrowGroup.add(shaft, head);
        arrowGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
        arrowGroup.position.copy(start);
        overlays.add(arrowGroup);
      }
      render();
    }
    new GLTFLoader().load(CLASSIC_MODEL_URL, gltf => {
      gltf.scene.traverse(child => {
        if (child instanceof THREE.Mesh) {
          if (disposed) child.geometry.dispose(); else geometries.add(child.geometry);
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach(mat => mat.dispose());
        }
      });
      if (disposed) return;
      try {
        for (const [type, name] of Object.entries(CLASSIC_PIECE_NODES)) {
          const source = gltf.scene.getObjectByName(name);
          if (!source) throw new Error(`Missing piece: ${name}`);
          const object = source.clone(true);
          object.position.set(0, 0, 0);
          object.updateMatrixWorld(true);
          const box = new THREE.Box3().setFromObject(object);
          const center = box.getCenter(new THREE.Vector3());
          const normalized = new THREE.Group();
          object.position.set(-center.x, -box.min.y, -center.z);
          normalized.add(object);
          // Source squares are approximately 3 units wide; one board square is 1.
          normalized.scale.setScalar(0.30);
          prototypes[type as keyof typeof CLASSIC_PIECE_NODES] = normalized;
        }
        setStatus("本地模型已就绪");
        update();
      } catch { setFailed(true); setStatus("3D 棋子加载失败，请切换到 2D 棋盘。"); }
    }, undefined, () => {
      if (!disposed) { setFailed(true); setStatus("3D 棋子加载失败，请切换到 2D 棋盘。"); }
    });
    const raycaster = new THREE.Raycaster();
    let pointerDown: [number, number] | null = null;
    function hit(event: PointerEvent): Square | undefined {
      const bounds = renderer.domElement.getBoundingClientRect();
      const pointer = new THREE.Vector2((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      return raycaster.intersectObjects(pickable, false)[0]?.object.userData.square;
    }
    const down = (event: PointerEvent) => { if (event.button === 0) pointerDown = [event.clientX, event.clientY]; };
    const up = (event: PointerEvent) => {
      if (pointerDown && Math.hypot(event.clientX - pointerDown[0], event.clientY - pointerDown[1]) < 5) {
        const square = hit(event); if (square) live.current.choose(square);
      }
      pointerDown = null;
    };
    const move = (event: PointerEvent) => setHovered(hit(event) ?? "");
    const cancel = () => { pointerDown = null; };
    const contextLost = (event: Event) => {
      event.preventDefault(); setFailed(true); setStatus("3D 图形上下文已丢失，请切换到 2D 棋盘。");
    };
    renderer.domElement.addEventListener("pointerdown", down, true);
    renderer.domElement.addEventListener("pointerup", up);
    renderer.domElement.addEventListener("pointermove", move);
    renderer.domElement.addEventListener("pointercancel", cancel);
    renderer.domElement.addEventListener("webglcontextlost", contextLost);
    const resize = () => {
      const width = element.clientWidth || 600;
      const height = element.clientHeight || 600;
      // CSS owns the viewport size; inline canvas sizes must not pin its height
      // when leaving fullscreen or crossing the square/wide breakpoint.
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.fov = boardCameraFov(camera.aspect);
      camera.updateProjectionMatrix(); render();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(element);
    view.current = { update, reset };
    reset(); resize();
    return () => {
      disposed = true; view.current = null;
      observer.disconnect(); controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", down, true);
      renderer.domElement.removeEventListener("pointerup", up);
      renderer.domElement.removeEventListener("pointermove", move);
      renderer.domElement.removeEventListener("pointercancel", cancel);
      renderer.domElement.removeEventListener("webglcontextlost", contextLost);
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(mat => mat.dispose()); textures.forEach(texture => texture.dispose());
      renderer.dispose(); renderer.forceContextLoss(); renderer.domElement.remove();
    };
  }, []);

  useEffect(() => { view.current?.update(); }, [fen, selected, props.arrows, props.evidenceSquares]);
  useEffect(() => { view.current?.reset(); }, [orientation]);

  return <div className="board-3d-frame">
    <div className="board-3d-stage" ref={host} />
    <div className="board-3d-toolbar">
      <span>{failed ? status : hovered ? `当前格 ${hovered}` : status}</span>
      <button type="button" onClick={() => view.current?.reset()}>重置视角</button>
      {failed && <button type="button" onClick={onFallback}>返回 2D</button>}
    </div>
    <p className="board-3d-hint">点击棋子再点击目标格走子 · 拖动旋转 · 滚轮缩放</p>
    <details className="board-3d-keyboard"><summary>键盘走子 / 局面坐标</summary>
      <div role="grid" aria-label="3D chess keyboard controls">
        {squares.map((square, index) => {
          const piece = chess.get(square);
          return <button key={square} type="button" role="gridcell" disabled={disabled}
            aria-label={`${square}${piece ? `, ${piece.color === "w" ? "white" : "black"} ${PIECE_NAMES[piece.type]}` : ""}`}
            aria-selected={selected === square} className={targets.includes(square) ? "is-target" : ""}
            onClick={() => choose(square)} onKeyDown={event => {
              const delta = ({ ArrowRight: 1, ArrowLeft: -1, ArrowDown: 8, ArrowUp: -8 } as Record<string, number>)[event.key];
              if (delta) {
                event.preventDefault();
                const buttons = event.currentTarget.parentElement!.querySelectorAll<HTMLButtonElement>("button");
                buttons[Math.max(0, Math.min(63, index + delta))]?.focus();
              }
            }}>{square}{piece ? ` ${(piece.color === "w" ? "♙♘♗♖♕♔" : "♟♞♝♜♛♚")[["p", "n", "b", "r", "q", "k"].indexOf(piece.type)]}` : ""}</button>;
        })}
      </div>
    </details>
  </div>;
}
