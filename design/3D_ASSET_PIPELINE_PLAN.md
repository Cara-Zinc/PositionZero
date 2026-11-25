# Position Zero：3D 棋子资产流水线开发方案

日期：2026-10-03。目标读者：在 Linux / NVIDIA L40 48GB 服务器上开发的 Coding Agent。
状态：开发规格，尚未部署、未验证 GPU 性能，也未完成第三方许可证审计。

## 1. 结论与开发边界

采用「可替换的生成后端 + 独立网格/材质处理 + 人工外形验收」，不要把整个系统绑定到某个模型。

- 第一候选：经审计的 TRELLIS 1 社区替换链，生成几何及颜色，再用独立工具制作低模与风格化 PBR。
- 第二候选：SAM 3D Objects，优先试验带顶点色的 mesh；不把 Gaussian PLY 当成游戏 mesh。
- TRELLIS.2：保留为可选对照后端。受限渲染依赖尚未排除前，不进入可发布资产路径。
- 不训练、不微调模型；先把红王从输入图走到可验证、带颜色的 GLB。
- L40 48GB 达到三者官方所述显存门槛，但不保证所有分辨率和导出设置都能一次运行；必须实测峰值。
- 本次服务器 Agent 只开发资产工具，不修改 Position Zero 的 Tauri/React/Rust 代码，不修改 Typer。
- 不覆盖现有 2D PNG；不继续之前暂停的 Blender 建模任务。后处理可用 Blender headless，但不意味着重启旧建模任务。
- 只在用户控制的服务器处理经用户提供的棋子设计图，不使用第三方生成 API、不公开结果、不上传棋谱或应用截图。
- 最终应用只打包静态 GLB/贴图；正常使用无需 GPU 服务器、模型权重、联网或 Python。

## 2. 许可选择：不能只看仓库的 MIT 标签

以下为工程风险梳理，不是法律意见。部署时固定 commit/权重 revision，并检查该版本，而非只依据本文。

| 后端 | 已核实事实 | 发布前门槛 |
| --- | --- | --- |
| TRELLIS 1 官方 | 模型和大部分代码 MIT；维护者明确指出原 mesh/GLB 提取和颜色烘焙涉及其他许可 | 不能直接认定原始导出链可商用 |
| TRELLIS 1 社区替换 | 存在 gsplat 渲染替换 PR #73、Marching Cubes 提取替换 PR #89 | 核实两项实际合入所选 commit，审计所有执行依赖和懒加载路径 |
| SAM 3D Objects | 模型和代码采用自定义 SAM License，不是 MIT；官方示例有 PyTorch3D 渲染、顶点色 mesh 路径 | 用户确认自定义许可；审计 Kaolin、提取器、渲染器等实际调用依赖 |
| TRELLIS.2 | 模型/代码 MIT；官方安装/渲染链列出 nvdiffrast、nvdiffrec | 当前检索到的两项许可含非商业研究/评估限制；替换并验证实际调用链，或取得适用授权 |

社区 fork 只是候选实现，不是许可清理证明。尤其不要直接 clone jclarkk/TRELLIS 的默认分支就声称它同时包含所有替换；应检查具体分支、补丁、提交以及安装脚本。

许可证审计至少产生 `licenses/dependency-audit.json` 和 `licenses/THIRD_PARTY_NOTICES.md`：

- 代码、模型、子模块、vendored 文件、编译扩展、贴图/环境光素材分别记录来源、版本、许可证路径和文件 SHA256。
- 区分安装但未使用、实际导入、实际执行、分发到客户端四类；未知或受限的实际执行项不能自动放行。
- 静态扫描之外，对一次完整生成/导出做运行追踪；禁止未获批准时静默回退到原受限 renderer/extractor。
- 单纯改成另一渲染器、删除许可证文件、重命名包或把受限代码复制进项目，都不是清理许可证。
- Marching Cubes 与 FlexiCubes 输出不等价；要验证解码出的 SDF、变形网格坐标、表面连通性与薄件质量。
- `release_eligible` 默认 false。只有依赖链审计和输入艺术品/照片权利均经人工确认，才可进入 release 目录。
- 模型使用许可、代码分发许可、生成资产权利、艺术品/博物馆照片权利分别处理。Meshy 那次 CC BY 4.0 授权不自动覆盖其他输入或今后的输出。

建议使用两个明确的策略配置：

- `research`：只有用户确认符合研究/评估用途后才启用受限依赖，结果留在 experiments；不可作为发布绕行路径。
- `release_candidate`：拒绝未知或未批准的执行依赖；生成成功不代表许可通过。

## 3. 输入资产与艺术方向

现有已认可的样式是 `design/porcelain-abstract-v2`；源 PNG 位于该目录的 `pieces/`，每张 512×512 RGBA。服务器只接收明确复制的输入目录，不同步整个项目。

命名有重要映射：

- `white-*` 表示国际象棋白方，在本套美术中是红方。
- `black-*` 表示国际象棋黑方，在本套美术中是黑方。
- 不把红黑两方做成同一个模型的换色版；双方角色、服饰和符号不同。
- 用 `white-king.png` 作为首个 smoke test；黑车仅在后续人工选择的测试批次中生成，不默认运行全套。

必须保留：

| 棋子 | 关键符号 / 不可接受的偏差 |
| --- | --- |
| 红王 | 工人黑帽、红衫、棕围裙、长柄金色锤；裤腿不能融合成裙子 |
| 黑王 | 金冠骷髅、黑兜帽长袍、双手扶中央竖剑；不能变成甲胄持短棒 |
| 红后 | 圆形传统头饰、粉红服饰和装饰物；保持原轮廓 |
| 黑后 | 黑金服饰、斜垂手势、丰饶角和金币；尊重已批准的服饰与遮挡，不自动改成另一人物 |
| 双方 bishop | 已批准的军装、帽型、披风与姿势，不改成常规象棋尖顶主教 |
| 双方 rook | 舟形 / 艺术化船体、原装饰和盾牌符号，不改成城堡 |
| knight | 红马 / 黑白金马的头部与鬃毛轮廓 |
| pawn | 红方麦穗及工具，黑方三排锁链和头部姿态 |

不要以常规棋子高度公式破坏本套艺术比例。底座居中、接地和占格尺寸必须统一，但人形、马头、舟形可以有不同高度。

透明背景不等于把图像直接丢弃 alpha。制作 RGB conditioning 时按后端要求合成中性背景，同时单独保留原 alpha mask；全透明像素的隐藏 RGB 不得污染边缘。
可生成高分辨率准备图，但普通插值/超分辨率不能凭空恢复原不存在的装饰细节。不得自动增加冠饰、文字或性别特征。

## 4. 系统架构

```text
输入 PNG + alpha mask + 元数据
    ↓ 校验 / 裁切 / 留白 / 哈希
生成后端适配器（TRELLIS1 替换链 / SAM3D / 可选 TRELLIS2）
    ↓ 原始几何、颜色表示、坐标信息、日志
候选多角度预览 → 人工选定几何
    ↓
修复 / 底座调整 / 低模 / UV / 颜色转移 / Normal 与 AO 烘焙
    ↓
风格化材质配置 → GLB / LOD / manifest
    ↓ 自动检查 + 人工艺术验收 + 许可放行
release 资产包 → 人工复制到 Position Zero
```

采用 Python CLI + YAML 配置 + JSON manifest。先不开发 Web API、数据库、ComfyUI 插件或公网服务。
ComfyUI 后续可作为 UI；核心流程必须可独立脚本执行和测试。

建议服务器独立目录（示例，不要求创建到系统根）：

```text
positionzero-asset-pipeline/
  src/pzassets/{cli,config,jobs,preprocess,backends,geometry,materials,export,validate}/
  configs/{red-king-smoke,full-set,material-style}.yaml
  schemas/{asset,job,metrics}.schema.json
  scripts/blender/{bake,render,export}.py
  tests/{unit,integration,fixtures}/
  licenses/
  inputs/                 # 只读副本
  models/                 # 权重本地缓存，不纳入 Git
  jobs/<job_id>/          # 不可变配置和阶段结果
  release/<asset_id>/<version>/
  README.md
```

不同后端依赖放入独立 Conda/容器环境，通过子进程和文件契约连接，不强行合并 PyTorch/CUDA 包版本。

### 后端契约

`generate(input_image, mask, config, work_dir) -> RawAssetManifest` 为项目自定义接口，不是假称上游具有同名 API。

Manifest 必须声明：`backend`、`repo_commit`、`weights_revision`、`seed`、`input_sha256`、`config_sha256`、`mesh_path`、`appearance_type`（vertex_color / uv_texture / gaussian / none）、`appearance_path`、`coordinate_transform`、`stage_timings`、`peak_vram_bytes`、`license_audit_id`。

- TRELLIS 1：形状和颜色分别保存；若颜色来源为 Gaussian，使用审计通过的 renderer 做多视图颜色转移，不能把 mesh normal 预览当作颜色贴图。
- SAM3D：优先保存真实 mesh + vertex colors。上游当前 notebook Inference 明确采用 PyTorch3D、关闭默认 mesh 后处理/纹理烘焙并启用 vertex colors；仍须核实完整下游 mesh 提取链，不能仅凭这一项配置宣布无受限依赖。
- TRELLIS.2：只有通过许可策略才启用 shape / texturing / export；把形状条件贴图作为独立可选阶段，禁止默认接在所有后端后面。
- 不支持某能力时返回 `unsupported`，不能生成假贴图或用灰模冒充带材质模型。

## 5. 网格与材质实现

### 几何

1. 保留原始高模。去除退化面、无效数值，检查法线与组件；碎片删除采用尺寸阈值加人工保留列表，避免删掉金币、锁链或刀剑。
2. 只修复确认的破洞。棋子允许合理开放表面，不默认全封闭或全体素化，以免把船体、衣褶和薄件糊在一起。
3. 红王裤腿融合属于语义几何错误，填洞/平滑无法可靠解决。提供人工修整或更换候选入口，状态标记 `needs_review`。
4. 底座可由可复用模板修整，但保留原艺术形状；记录变换，不自动替换所有棋子为圆底座。
5. 静态棋子优先保轮廓减面，不要求四边面和骨骼。高模 → LOD0 → LOD1 → LOD2，每个 LOD 均检查 UV/材质，不直接丢失顶点色。
6. 坐标最终采用 glTF 的 Y-up；底座中心原点，最低接地点 Y=0；朝向约定 front=+Z。Blender Z-up 到 glTF 转换只执行一次，并用非对称 fixture 验证。

### 有颜色的 MVP，再做 PBR

「有颜色」是第一验收项，不依赖 AI 自动推断全套 PBR。

- 顶点色来源：在高模保留颜色，用 Blender 将颜色属性烘焙到低模 Base Color；需明确线性/sRGB 解释。
- Gaussian 来源：经审计的 renderer 输出颜色、alpha、深度/可见性，结合真实相机参数进行多视图投影和遮挡过滤，再求 UV atlas 颜色；禁止将遮挡的背面投影成正面颜色。
- 参考图投影仅在姿态/相机匹配后覆盖可见区域，背面由生成颜色或人工批准的补图补足，标记来源与置信度。
- UV atlas 用 xatlas 或 Blender 展开；减面/重网格后重新烘焙，而不是继续套用旧 UV。
- Normal：从高模几何烘焙到低模，使用与目标渲染器匹配的切线空间；AO 从几何计算，不把阴影重复绘制到 Base Color。
- Roughness/Metallic：第一版以人工确认的材质区域 mask 和统一预设生成，可先全体 non-metal + 统一 roughness，随后添加金属边饰。不能把黄像素一律判为金属，不能把肤色误判为象牙材料。
- 暂定瓷釉 roughness 0.20–0.35、非金属 metallic=0；金属装饰 metallic 0.8–1.0、roughness 0.25–0.40，仅为可调艺术预设，不是从参考图恢复的物理测量值。
- 单图光照会混入颜色，去光照作为可选阶段，不默认调用外部服务或昂贵模型；保持原图和处理图，避免损坏脸部与纹饰。
- glTF ORM：R=AO、G=Roughness、B=Metallic；正确配置 occlusionTexture 与 metallicRoughnessTexture。Base Color 按 sRGB，数据贴图按非颜色数据处理。

GLB 首版使用嵌入 PNG/JPEG，不依赖 WebP/KTX2/Draco 扩展才能打开。压缩后另存产物并回归验证，保留无扩展版本。

## 6. L40 48GB 运行策略

- 官方门槛参考：TRELLIS1 ≥16GB、TRELLIS.2 ≥24GB、SAM3D ≥32GB；只是门槛，不是本项目实测峰值。
- 先诊断驱动、CUDA、GPU 架构、编译器、PyTorch CUDA wheel 与扩展 ABI；使用后端已验证组合并冻结锁文件，不盲目安装最新版。
- CUDA 编译扩展以实际设备 capability 为准；诊断后再设置，不硬编码其他 GPU 架构。
- `GPU worker=1`，一个阶段只加载所需模型；候选逐个生成。CPU 后处理允许独立限额并行，不在 GPU 上同时跑三个模型。
- 先最低可用质量/分辨率 smoke test，再加质量。TRELLIS1 不强行接受 TRELLIS.2 的 voxel 参数；后端配置必须能力校验。
- 每资产初始只生成 1 个候选，人工要求后最多扩展到 3 个不同 seed，不自动反复生成直到满意。
- 记录模型加载、推理、mesh 导出、UV、烘焙和预览分别耗时；记录 PyTorch allocated/reserved 和设备总显存占用。
- OOM 最多自动重试 1 次，采用记录在案的降级配置；不要把 CUDA cache 清理当作可靠卸载。必要时结束该 worker 后重新起进程。
- 任务允许取消、阶段超时、重启恢复；失败保留日志和可用中间产物。不得把未知失败无限重试。
- 权重预下载后可离线运行，禁用遥测与公共 Gradio share；日志不含 token，不接受未经校验的任意文件路径或配置代码执行。
- CPU 内存/磁盘最低需求由 smoke test 实测并写入 README；不要把 48GB 显存等同于 48GB 系统内存。

## 7. CLI、配置与输出规格

下面是待实现接口，不是现有命令：

```sh
pzassets doctor --backend sam3d
pzassets audit --backend trellis1-refactor --policy release_candidate
pzassets prepare --config configs/red-king-smoke.yaml
pzassets generate --config configs/red-king-smoke.yaml
pzassets preview --job JOB_ID
pzassets select --job JOB_ID --candidate SEED
pzassets build --job JOB_ID --profile board
pzassets validate --job JOB_ID
pzassets approve --job JOB_ID --review-file approval.json
pzassets package --job JOB_ID
```

示例配置应通过 schema 校验，未知字段报错：

```yaml
schema_version: 1
asset_id: white-king
chess_side: white
visual_side: red
role: king
input: inputs/white-king.png
backend: trellis1-refactor
policy: release_candidate
seeds: [42]
max_candidates: 3
max_oom_retries: 1
appearance: baked_base_color
material_style: red-black-porcelain
texture_size: 1024
lod_triangles: [12000, 6000, 2000]
square_size: 1.0
max_footprint: 0.82
gpu_workers: 1
```

三角面预算为项目起始目标，可因舟形/薄件调整；不得为了达到数值自动毁掉造型。1.3 倍是旧 2D 的显示缩放，不机械套到 3D 几何上。

`release/<asset_id>/<version>/` 至少包含：

- `lod0.glb`、`lod1.glb`、`lod2.glb`：各自完整可打开，不依赖工作目录外路径。
- `source-high.glb` 或明确标记的高模格式：保留颜色及变换信息，不纳入应用运行包。
- `textures/`：Base Color、Normal、ORM 和必要的 region masks；保留无损生产版本。
- `preview/{front,left,right,back,top,board}.png`、`turntable.mp4`。
- `manifest.json`：三角面、纹理、坐标、占格、后端、哈希、来源、许可和人工审批。
- `metrics.json`、`review.json`、`THIRD_PARTY_NOTICES.md`。

缓存键包括输入图/mask、配置、代码提交、权重版本、材料预设、工具版本；不只按文件名。输出写入临时目录成功后原子发布，不覆盖前一版本。

## 8. 自动和人工验收

所有指标标为 pass / fail / warning / not_evaluated，缺少依赖时不能假绿。

自动硬性检查：

- mesh 非空，坐标/法线有限，无零面积面；UV 有效，贴图可解码、路径完整，材质实际绑定。
- Base Color 或顶点色不是空白占位。近灰检测只产生 warning，不能拒绝本来就是黑白瓷器的棋子。
- LOD 面数和 GLB 大小不超过可配置预算；建议每个运行用 LOD0 GLB 初始软上限 8MiB，超限先报告。
- 接地点偏差 ≤0.001 square；X/Z 居中偏差 ≤0.01 square；水平包围盒 ≤0.82 square 或有批准例外。
- 原点/朝向/UV channel/切线空间一致；glTF validator 无 error，warnings 解释记录。
- 三个 LOD 均在两种背景、固定中性光和旋转光下渲染；Base Color 无光照预览与 PBR 预览分别保存。
- 法线翻转、UV 重叠、非流形边、组件数和自交作为可配置检查；开放船体、装饰小件需有例外记录，不能强制全部 watertight。
- 重启恢复不重复推理；同参数缓存命中、参数变更失效、OOM/取消状态正确；release 策略未知依赖阻断。
- 如声称离线可用，权重缓存后在无外网环境完成一次从输入到 GLB 的测试。

人工必须检查：角色符号、正面相似性、侧背面合理性、裤腿分离、手部与工具、剑/锤柄连续性、舟形轮廓、衣褶与肤色、金饰一致性、小尺寸棋盘可辨识度。
单图无法保证真实背面；任何背面补全都要标为生成推测，不声称忠实还原历史实物。

32 棋子棋盘预览使用共享 geometry/material 实例，固定相机可旋转；在目标 Mac 真正测量加载时间、内存和帧率后才能声明 runtime-ready。服务器静态预览不能代替 Apple Silicon 验收。

## 9. 分阶段任务与完成标准

- [ ] P0 环境和许可审计：列出确切 fork/commit/权重/执行依赖；说明 TRELLIS1 两项替换是否都可用；提供后端选择 ADR。未知许可禁止发布，但不阻止开发无模型 fixture 的后处理模块。
- [ ] P1 颜色 MVP：一个红王、一份可旋转带颜色的 GLB、正侧背截图、计时与显存报告。优先对比 TRELLIS1 替换链与 SAM 顶点色；不要求全套 PBR。
- [ ] P2 游戏资产处理：UV、低模、颜色转移、Normal/AO、材质预设、三档 LOD；对错误裤腿明确标记需人工修整。
- [ ] P3 批处理可靠性：CLI、schema、缓存、断点恢复、取消、OOM 降级、每阶段测试；确认后再处理剩余棋子。
- [ ] P4 艺术压力测试：经用户选择生成黑王、黑车、黑后，验证骷髅/剑、舟形、服饰与小装饰；没有批准不自动批量生成。
- [ ] P5 全套交付：12 种独立棋子、32 棋子预览、审核记录、运行资产与高模分离；许可状态不明的资产不能进入发布包。

本轮不包含应用 3D 棋盘实现。未来 Position Zero 接入应保留 2D fallback，单独评估 three.js / React Three Fiber 与本地 WebGL 能力；不得默认引入联网加载器。

## 10. 可直接交给服务器 Coding Agent 的任务

> 请实现本规格中的独立 3D 资产工具，不修改 Position Zero/Typer 应用。先检查 L40 48GB 环境和实际许可证，再选定可审计的 TRELLIS1 社区替换链或 SAM3D；不要因仓库 MIT 标签跳过导出依赖审计。先完成 P0/P1，以用户提供的 white-king.png 输出真正带颜色的 GLB、完整来源 manifest、多角度预览、测试及实测性能。PBR 的粗糙度/金属度可先采用明确标记的人工风格预设，不得把灰模当作成功，也不得宣称已恢复真实物理材质。禁止购买 API、公开资产、上传其他文件、自动生成全套、接受未经授权的模型协议、训练模型或无限重试。遇到模型访问协议时交由用户处理。若后端被许可阻断，继续开发 fixture 驱动的 UV/烘焙/导出/验证模块并报告具体阻断项，不静默改用受限实现。每项完成均需真实产物和测试证据。

## 11. 来源与再核验清单

以下为 2026-10-03 检索到的上游信息；后续开发必须固定版本并保存许可证副本。

1. [TRELLIS 官方 README：硬件、颜色 GLB、许可证例外](https://github.com/microsoft/TRELLIS)。
2. [维护者说明原始导出链的商业使用限制](https://github.com/microsoft/TRELLIS/issues/41)。
3. [gsplat 替换 PR #73](https://github.com/microsoft/TRELLIS/pull/73)、[Marching Cubes 替换 PR #89](https://github.com/microsoft/TRELLIS/pull/89)。仅作为候选补丁，不是审计通过证明。
4. [SAM3D 官方仓库](https://github.com/facebookresearch/sam-3d-objects)、[环境要求](https://github.com/facebookresearch/sam-3d-objects/blob/main/doc/setup.md)、[当前 notebook Inference 的颜色路径](https://github.com/facebookresearch/sam-3d-objects/blob/main/notebook/inference.py)、[SAM License](https://github.com/facebookresearch/sam-3d-objects/blob/main/LICENSE)。
5. [TRELLIS.2 官方仓库](https://github.com/microsoft/TRELLIS.2)、[形状条件贴图示例](https://github.com/microsoft/TRELLIS.2/blob/main/example_texturing.py)。
6. [nvdiffrast License](https://github.com/NVlabs/nvdiffrast/blob/main/LICENSE.txt)、[nvdiffrec License](https://github.com/NVlabs/nvdiffrec/blob/main/LICENSE.txt)。注意正文限制，不只看许可名称。
7. [ComfyUI TRELLIS2 封装](https://github.com/PozzettiAndrea/ComfyUI-TRELLIS2)、[GeometryPack](https://github.com/PozzettiAndrea/ComfyUI-GeometryPack)。可选 UI/后处理参考，仍要逐项审计。

本文件只创建开发方案，没有安装软件、接受许可、上传图片或生成新资产。
