# POSITION ZERO 开发进度

> 更新日期：2026-10-03
> 项目范围：独立的 Tauri 2 + React + TypeScript + Rust 桌面应用  
> 目标平台：macOS Apple Silicon  
> 运行原则：本地离线，不连接 chess.com，不上传棋谱、截图或其他用户数据

## 状态说明

- `[x]` 已完成并已进入当前代码
- `[ ]` 尚未完成
- `P0` 正确性、数据安全或核心流程问题
- `P1` 下一阶段的重要增强
- `P2` 体验优化或长期事项

## 当前进度概览

- [x] 前端单元/组件测试：15 个测试文件，共 52 项测试通过
- [x] Rust 单元测试：3 项测试通过
- [x] TypeScript 检查与 Vite 生产构建通过
- [x] Stockfish 18 sidecar 已确认为 Mach-O ARM64 可执行文件
- [x] ONNX 模型、ONNX Runtime WASM 与本地开局库已打包
- [x] 本地 release `.app` 已生成
- [ ] 建立首次 Git 基线提交；当前 `main` 尚无提交，项目文件均未跟踪 `P0`

## 已支持功能

### 1. 本地导入

- [x] 从 `.pgn` 文件导入棋谱
- [x] 通过拖放和剪贴板导入 PGN
- [x] 解析多局 PGN 并选择要建立的研究局
- [x] 保留原始 PGN 中的注释、NAG 和变例文本
- [x] 为主线每一手生成 UCI、SAN、走子前 FEN 和走子后 FEN
- [x] 导入完整六字段 FEN，并检查局面及双方王的合法性
- [x] 使用本地 fenshot ONNX/WASM 模型识别棋盘截图
- [x] 自动识别截图方向，并显示逐格置信度
- [x] 截图识别后允许在棋盘上逐格修正棋子
- [x] 截图确认时可设置行棋方和王车易位权
- [x] 导入局面后自动启动快速分析，并允许继续走子

### 2. 棋盘与局面操作

- [x] 点击起点/终点走子
- [x] 拖动棋子走子
- [x] 只允许当前行棋方执行合法走子
- [x] 默认自动升变为后，并支持 UCI 升变后缀
- [x] 显示 A–H 与 1–8 坐标，翻转棋盘时同步镜像
- [x] 支持棋盘翻转和黑白视觉反相
- [x] 使用白方实心棋子视觉
- [x] 显示引擎候选着箭头和讲解证据格
- [x] 显示并复制当前 FEN
- [x] 浏览导入棋谱的主线着法和任意 ply 局面
- [x] 从历史节点继续走子时建立新的当前主线
- [x] Image、PGN、FEN 和初始棋局共用可回退、前进、回到根局面和跳到最新局面的分析轨道
- [x] 在历史节点选择引擎着法或手动走子时，明确截断并替换该节点之后的旧推演
- [x] 经典黑白 3D 棋盘：本地 CC0 GLB、点击合法走子、旋转/缩放/重置、翻转相机、候选着箭头与证据格，保留 2D 切换和 WebGL 失败回退
- [x] 3D 全屏/宽窗口布局：视口最大宽度 1150px，高度随窗口调整；相机按宽高比适配，退出全屏恢复尺寸；2D 布局不变
- [ ] 红黑艺术棋子 3D 套装完成后接入；保持经典套装作为备用 `P2`

### 3. Stockfish 本地分析

- [x] 捆绑 Stockfish 18 ARM64 UCI sidecar
- [x] 完成 UCI 握手、`readyok` 检测和状态展示
- [x] 支持 Quick、Scan、5 秒、15 秒和 60 秒分析入口
- [x] 流式接收并显示 MultiPV 候选变化
- [x] 解析 centipawn、mate、WDL、depth、nodes、NPS 和 hashfull
- [x] 切换局面时停止旧搜索并排队最新任务
- [x] 缓存分析结果，并设置约 256 MiB 软上限
- [x] 支持手动清空分析缓存
- [x] 支持 Threads、Hash、MultiPV 和 Fixed Depth 设置界面
- [x] 支持手动重启引擎
- [x] 引擎异常退出后自动检测并尝试恢复
- [x] App 退出、Mac 休眠或关机前清理 Stockfish 进程
- [x] Mac 唤醒后重新初始化引擎
- [x] 修复异步运行时内调用阻塞锁导致的 restart panic

### 4. 整局扫描与讲解

- [x] 使用本地 Lichess CC0 数据显示 ECO 和开局名称
- [x] 整局浅扫从首次偏离开局库附近开始
- [x] 按胜率期望损失标记 inaccuracy、mistake 和 blunder
- [x] 可按记住的玩家别名只评估自己一方的着法
- [x] 显示最严重的训练卡候选局面
- [x] 基于可验证棋盘事实生成规则化讲解
- [x] 已支持强制将杀、升变、吃松子、将军和双攻等讲解类型
- [x] 未识别到明确战术时使用保守的 Engine Preference 提示

### 5. 研究库与本地数据

- [x] 使用 `PZ—####` 编号保存研究局面
- [x] 支持 PGN、FEN、截图和临时手动局面来源
- [x] 保存研究标题、根局面、当前局面、主线、标签和个人笔记
- [x] 导出研究对应的原始 PGN
- [x] 使用 SQLite 保存研究、训练卡、复习记录、别名和分析缓存
- [x] 非 Tauri 环境使用 localStorage/内存作为开发回退
- [x] 数据库迁移在应用启动时自动执行
- [x] 所有运行时资源均从本地加载

### 6. 训练与复习

- [x] 从当前最佳变化创建训练卡
- [x] 接受与最佳着胜率期望接近的多个首着
- [x] 训练中自动播放引擎应手，并练习最多四个 ply
- [x] 支持 Reveal line
- [x] 支持 Again、Hard、Good 三档评分
- [x] Again 在 10 分钟后重现并累计 lapse
- [x] Hard 和 Good 使用固定间隔倍率
- [x] 只载入当前到期的训练卡

### 7. 界面与品牌

- [x] 响应式研究索引、棋盘区和分析面板布局
- [x] 移动宽度下可开关位置索引
- [x] POSITION ZERO 单色 SVG Logo
- [x] 中文 README、英文 README 和第三方许可证说明
- [x] 无遥测、无账户连接、无运行时网络请求

### 8. 棋盘皮肤与换装

- [x] 从 `design/chess_set.png` 采样材质色，设计 `auction` 皮肤（羊皮纸 · 牛血红 · 黄铜）
- [x] 四套皮肤：`mono`（原黑白，默认）、`auction`、`court`、`noir`
- [x] 每套皮肤各有一套白天配色和一套夜间配色
- [x] 以 13 个 CSS 变量描述一套皮肤，棋盘只读变量，换皮肤只是换变量
- [x] 标记色按格子明暗分开（`--board-ink-light` / `--board-ink-dark`），纯色深格上依然清晰
- [x] 矢量雕刻剪影棋子：`design/chess-pieces-v1.svg` 的单体路径 + 皮肤材质色
- [x] `mono` 保持归档标本棋子与 45° 斜线公式，与原棋盘逐字节一致
- [x] 头部换装面板：格子预览、当前皮肤说明、键盘 Escape 与点外关闭
- [x] 皮肤选择持久化到 localStorage，重启后保留
- [x] 对比度验收测试：坐标字 ≥ 4.5、标记 ≥ 3、棋子主体或描边 ≥ 3
- [x] 生成 `design/skins-preview.html` / `.png` 对照表，并逐格核对 8 块棋盘渲染结果
- [x] 设计说明：`design/board-skins.md`

### 9. 棋子几何（从参考图提取）

- [x] 从 `design/chess_set.png` 切出 12 个形体：逐行统计金色包边占比定位底座分界线（y=481 / y=923）
- [x] 用 potrace 把每个形体描摹成平滑贝塞尔路径，最差 IoU 0.955，全部 ≥ 0.955
- [x] 归一化为 100 单位高度并居中，保留参考图中的真实长宽比
- [x] 列顺序（王 · 后 · 象 · 马 · 车 · 兵）由三条独立证据交叉确认：Vision 分类标签、高度排序、常规排布
- [x] 两阵营分别出图：`PIECE_GEOMETRY.w` / `PIECE_GEOMETRY.b`，`PieceGlyph` 按阵营取用
- [x] 三层结构：`silhouette` 主体 + `panel` 对比材质 + `trim` 金饰，保留参考图的花纹而不是压成单色剪影
- [x] 仅 `auction oxblood` 使用描摹棋子；`mono` / `court` / `noir` 继续使用标准棋子（`design/extracted-clker-chess/`）
- [x] 标准棋子的唯一来源固定为 `design/extracted-clker-chess/`，由 `npm run sync:assets` 同步到 `public/pieces/clker/`
- [x] 修正运行目录里混入 `design/bishop-variant-a/` 实验版的 bishop，恢复为标准 bishop
- [x] 材质分区按色相分类、半径 9 像素软多数滤波去噪，分区先做腐蚀再取交集，保证不溢出轮廓
- [x] 分区验收：主体 IoU 0.955–0.992，对比材质 IoU 0.859–0.961，金饰 IoU 0.930–0.960
- [x] 路径不含颜色，三层各自读皮肤变量（fill / panel / trim / edge），换装仍然只换颜色
- [x] 每层使用 `fill-rule: evenodd`，眼睛与镂空正确成为洞；描边只画在主体上
- [x] 对比度验收扩展：四种材质至少一个与格子 ≥ 3，且花纹相对主体 ≥ 1.15
- [x] 新增放大花纹对照表 `design/pieces-pattern.html|png`
- [x] 提取脚本 `scripts/extract-chess-set-pieces.py` 可重跑，并在 IoU < 0.94 时直接失败
- [x] 8 块棋盘 × 64 格逐格核对：空格贴合参照，32 枚棋子全部落位（间距 10.8×–29.6×）

## 下一阶段任务

### P0：正确性与核心稳定性

- [ ] 让 Engine Settings 中的 `MultiPV` 真正进入 `AnalysisRequest`；当前普通分析固定为 3，整局扫描固定为 1
- [ ] 重构分析缓存身份：把 Fixed Depth、Threads、Hash、搜索模式等会影响结果的参数纳入缓存匹配，避免深度搜索误用时间搜索缓存
- [ ] 补齐截图导入的 en-passant 目标格输入和校验；当前生成 FEN 时该字段固定为 `-`
- [ ] 为整局扫描增加 `try/catch/finally`，保证单个局面分析失败时不会让进度永久停留
- [ ] 为整局扫描提供显式取消，并确保取消后恢复当前局面的快速分析
- [ ] 检查自动分析、手动深析和整局扫描并发切换时的任务归属，避免旧任务错误更新 UI
- [ ] 建立首次 Git 基线提交，并确认大体积运行资源和构建产物均按预期忽略
- [ ] 在完全断网环境对 release `.app` 做一次端到端冒烟测试：PGN、FEN、截图、分析、重启、保存、退出后恢复

### P1：测试与可维护性

- [ ] 为 `src/lib/engine.ts` 增加事件先于 invoke 返回、任务替换、取消、错误和缓存命中的测试
- [ ] 为分析缓存增加不同 Depth、MultiPV、Threads、Hash 组合的隔离测试
- [ ] 为 SQLite/localStorage 两条存储路径增加研究、卡片、删除和复习记录测试
- [ ] 为截图修正、元数据确认、识别失败和低置信度提示增加组件测试
- [ ] 为 `App` 增加导入后自动分析、历史节点续走、整局扫描和创建卡片的集成测试
- [ ] 扩充 Rust 引擎测试：连续替换多个任务、取消排队任务、终止、握手超时和 sidecar 异常退出
- [ ] 增加固定的离线构建检查，防止 CDN URL 或远程资源意外进入产物
- [ ] 增加 CI 或本地统一校验命令，依次运行前端测试、前端构建、Rust fmt/clippy/test
- [ ] 拆分体积较大的 `App.tsx` 和 Rust engine manager，降低状态耦合

### P1：研究库与训练管理

- [ ] 在界面中接入已有的研究删除能力，并增加二次确认
- [ ] 支持重命名研究、编辑标签和筛选/搜索研究库
- [ ] 增加训练卡列表，支持查看、编辑、暂停和删除卡片
- [ ] 展示单卡复习历史、lapse 次数和下次到期时间
- [ ] 支持撤销刚才的复习评分
- [x] 明确并可视化历史节点续走后的分支处理，避免用户误以为原主线仍完整保留
- [ ] 增加本地数据备份/恢复和 JSON/PGN 导出，不依赖云服务

### P1：分析体验

- [ ] 持久化 Engine Settings，并提供恢复默认值按钮
- [ ] 在分析面板显示当前搜索约束：movetime 或 fixed depth、Threads、Hash、MultiPV
- [ ] 增加当前分析的 Stop 按钮
- [ ] 扫描结果支持按严重程度筛选，并能逐项跳转
- [ ] 为扫描失败、引擎重启和缓存清理提供明确的非阻塞反馈
- [ ] 允许用户调整 inaccuracy、mistake、blunder 的判定阈值
- [ ] 扩展规则化讲解，但每种新 motif 必须有可验证证据和测试

### P2：体验优化

- [x] 将新版红黑艺术棋子接入 Auction oxblood 猩红主题，统一透明画布与基线，保留持剑死神黑王；同步主题预览并补充资源/切换回归测试

- [ ] 增加键盘快捷键：前后手、翻转棋盘、开始分析、停止分析和关闭弹窗
- [ ] 增加导入历史与最近打开位置
- [ ] 改善大型 PGN、多局 PGN 和超长主线的性能
- [ ] 为低置信度截图格提供更明显的筛选和逐格复核流程
- [ ] 增加可选的声音与动画设置，默认保持克制且完全本地
- [ ] 继续扩充棋盘皮肤（枫木/黄铜、瓷青花等），每套都必须通过对比度验收
- [ ] 允许用户自定义皮肤并导出/导入为 JSON（纯本地，不依赖云服务）
- [ ] 为换装面板补上方向键选择与皮肤切换动画（`prefers-reduced-motion` 下关闭）
- [ ] 完善 VoiceOver 标签、焦点管理、颜色对比度和仅键盘操作
- [ ] 为个人分发补充可选的签名、公证说明；不引入在线更新依赖

## 明确不做

- [x] 不连接 chess.com 或其他在线棋类账户
- [x] 不上传棋谱、截图、局面、笔记或训练数据
- [x] 不加入运行时遥测、广告或云端 AI 调用
- [x] 不修改或依赖 `/Users/zincara/self_learn/Typer`
- [x] 当前不支持 Intel Mac、Windows、Linux、iOS 或 Android 发布

## 每次提交前检查

```sh
cd /Users/zincara/self_learn/PositionZero
npm test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
```

涉及 Tauri、sidecar、数据库迁移、ONNX/WASM 或打包资源时，还应执行：

```sh
cd /Users/zincara/self_learn/PositionZero
npm run tauri build
open "/Users/zincara/self_learn/PositionZero/src-tauri/target/release/bundle/macos/POSITION ZERO.app"
```

冒烟测试至少覆盖：导入 PGN、导入 FEN、导入截图、自动分析、切换局面、引擎重启、创建训练卡、完成一次复习、退出并重新打开。
