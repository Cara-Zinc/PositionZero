# 棋盘皮肤系统（Board skins）

> 目的：把棋盘从「唯一的黑白样式」变成「可换装的皮肤系统」。
> 代码：`src/lib/themes.ts`（数据）、`src/lib/appearance.ts`（状态与落地）、
> `src/components/BoardStylePicker.tsx`（换装界面）。

## 1. 配色来源

`design/chess_set.png` 是这次配色与风格的依据。以下是直接从该图采样得到的材质色：

| 材质 | 采样到的颜色 | 说明 |
| --- | --- | --- |
| 象牙 / 羊皮纸 | `#fef0d5`、`#f0d8a8` | 浅色棋子的主体、画面底色 |
| 金黄 / 琥珀 | `#f8be5e`、`#e5802f` | 深色棋子上的金色描边与底座 |
| 牛血红 | `#ca1915` → `#920403` → `#6b0906` | 深色棋子的漆面，明暗跨度很大 |
| 黑漆 | `#181818`、`#131716` | 深色棋子的暗部与轮廓 |

采样值不能直接当界面用色：`#fef0d5` 上的金色坐标字读不出来，`#920403` 上的深色标记也读不出来。
所以每一套皮肤都是「按材质重新定色」，并且必须通过第 3 节的对比度验收。

## 2. 皮肤清单

每套皮肤同时定义白天与夜间两套：`day` 为默认，`night` 可选（未提供时由 `dimPalette()` 自动压暗）。

| id | 名称 | 棋盘材质 | 棋子 |
| --- | --- | --- | --- |
| `mono` | Mono hatch | 纸 · 墨 · 45° 细斜线（默认皮肤） | 标准棋子 |
| `auction` | Auction oxblood | 羊皮纸 · 牛血红 · 黄铜 | 参考图描摹（三层，见第 7 节） |
| `court` | Court celadon | 瓷白 · 青瓷 · 石墨 | 标准棋子 |
| `noir` | Noir lacquer | 炭灰 · 骨白 · 黄铜 | 标准棋子 |

**标准棋子**指 `design/extracted-clker-chess/` 里那套（`public/pieces/clker/` 只是运行时的镜像）。
它自带黑白配色，所以这几套皮肤不使用下面的棋子材质变量，只有 `auction` 用描摹出来的三层几何。

`auction` 是这次新设计的主皮肤：浅格用羊皮纸并在其上织入细麻纹，深格用牛血红丝面，
棋盘托座是深胡桃木，坐标与引擎箭头用黄铜色。浅色棋子是象牙雕刻配深棕描边，
深色棋子是牛血红漆面配金色描边——金色描边正是深色棋子在深色格上仍然清晰的原因。

`mono` 的棋盘与改动前的棋盘逐字节一致（同样的 45° 斜线公式、同样的黑白），
只是多了一个夜间版本；它的棋子现在也改用第 7 节的统一几何，以纯白 / 近黑材质呈现。

## 3. 变量与不变量

一套皮肤只产出一组 CSS 变量，写在 `<html>`（白天）和 `.app`（夜间）上，棋盘只读这些变量：

| 变量 | 作用 |
| --- | --- |
| `--board-light` / `--board-dark` | 两种格子的底色 |
| `--board-light-texture` / `--board-dark-texture` | 织纹（`none` 或 `repeating-linear-gradient(...)`） |
| `--board-frame-surface` | 棋盘托座（坐标字印在上面） |
| `--board-frame-line` | 外框与棋盘边线 |
| `--board-frame-ink` | 坐标字，以及引擎候选箭头 |
| `--board-ink-light` / `--board-ink-dark` | 选中、目标点、证据格的标记色**按格子明暗分开** |
| `--piece-light-fill` / `--piece-light-edge` | 浅色棋子主体 / 描边 |
| `--piece-dark-fill` / `--piece-dark-edge` | 深色棋子主体 / 描边 |

两条不变量：

1. **标记色按格子分列。** 纯色深格（牛血红）上画深色标记会看不见，
   所以 `is-light` 与 `is-dark` 各自声明 `color`，标记统一用 `currentColor` 绘制。
2. **织纹公式统一。** 所有皮肤共用
   `repeating-linear-gradient(135deg, 底色 0 2px, 织线 2px 3px, 底色 3px 6px)`，
   换皮肤只换颜色，节奏不变，因此皮肤不会互相「打架」。

## 4. 对比度验收

`src/lib/themes.test.ts` 用 WCAG 对比度对**每套皮肤 × 白天/夜间**做硬性检查：

- 坐标字 / 托座 ≥ 4.5
- 标记色 / 对应明暗格子 ≥ 3
- 棋子可见性：主体或描边**至少一个**与两种格子都 ≥ 3
  （象牙棋子靠描边在浅格上成立，牛血红棋子靠金边在深格上成立）

这套检查在开发期间真的拦下过问题：最初 `auction` 的深色棋子与牛血红格对比只有 1.41，
`noir` 的深色棋子与炭灰格只有 1.20，都因为描边色不对而被判不通过，然后才改成金色描边。

## 5. 新增一套皮肤

```ts
// src/lib/themes.ts
{
  id: "walnut",
  label: "Walnut & brass",
  caption: "枫木 · 胡桃木 · 黄铜",
  note: "一句话说明来源。",
  pieceArt: { kind: "vector" },          // 或 { kind: "image", directory: "/pieces/..." }
  day: { light: "...", dark: "...", lightWeave: null, darkWeave: "...",
         frameSurface: "...", frameLine: "...", frameInk: "...",
         inkOnLight: "...", inkOnDark: "...",
         lightPiece: { fill: "...", edge: "..." },
         darkPiece: { fill: "...", edge: "..." } },
  night: { /* 可选，只写需要覆盖的字段 */ },
}
```

1. 在 `ThemeId` 上加 id，并在 `THEMES` 里追加一项；
2. 跑 `npm test`，对比度验收会告诉你哪一组颜色不合格；
3. `npx vite-node scripts/build-skin-preview.ts` 重新生成对照表。

## 6. 预览对照表

`scripts/build-skin-preview.ts` 用**同一份 token 与同一套棋子几何**生成
`design/skins-preview.html`（可直接用浏览器打开）：

```sh
npx vite-node scripts/build-skin-preview.ts
```

`design/skins-preview.png` 是该页面在 2× 缩放下的截图。对照表里每块棋盘都在
`data-grid-x/y`、`data-cell` 上标注了自己的网格原点，因此可以逐格核对渲染结果：
校验脚本按明暗两色各取一个空格的像素作参照，结果如下（空格的偏差越小越好，
有棋子的偏差越大越说明棋子真的画出来了）：

| 皮肤 | 空格最大偏差 | 棋子最小偏差 | 比值 |
| --- | --- | --- | --- |
| mono day | 1.21 | 24.93 | 20.6× |
| mono night | 0.92 | 8.60 | 9.4× |
| auction day | 0.52 | 8.30 | 16.1× |
| auction night | 0.59 | 12.43 | 21.0× |
| court day | 0.90 | 12.20 | 13.6× |
| court night | 0.85 | 12.04 | 14.2× |
| noir day | 0.72 | 8.59 | 11.9× |
| noir night | 0.78 | 7.02 | 9.0× |

空与有棋子之间始终有 9 倍以上间隔，说明 8 块棋盘 × 64 格的格色、明暗交替、
坐标与 32 枚棋子都落在正确的位置上。

## 7. 棋子几何（来自同一张参考图，仅 `auction` 使用）

`auction` 的棋子是 `design/chess_set.png` 里的 12 个形体，逐格描摹成矢量路径，见
`src/lib/pieceGeometry.ts`。其余三套皮肤继续使用标准棋子
（`design/extracted-clker-chess/`），由 `pieceArt` 在皮肤里选择：

```ts
{ kind: "standard", directory: "/pieces/clker" }   // 标准棋子，自带黑白配色
{ kind: "carved" }                                 // 参考图描摹的三层几何，跟随皮肤配色
```

标准棋子的唯一来源是 `design/extracted-clker-chess/`，`public/pieces/clker/` 由
`npm run sync:assets`（也会在 `npm install` 后执行）同步，避免两处再次分叉 ——
之前那对 `bishop` 就出现过运行目录里放的是 `design/bishop-variant-a/` 的实验版。

### 7.1 从照片里切出棋子

参考图是一张 2 行 × 6 列的照片：一行一个阵营。每个形体都立在自己的底座上，
底座上沿是一条**均匀的金色包边**，这就是棋子与展示底座的分界。逐行统计金色像素占比，
可以看它在两行里分别从约 10% 跳到约 85%：

| 行 | 阵营 | 金色包边上沿 | 棋子纵向范围 |
| --- | --- | --- | --- |
| 第 1 行 | 浅色方（象牙 + 牛血红） | y = 481 | y 168 – 480 |
| 第 2 行 | 深色方（黑漆 + 金） | y = 923 | y 565 – 922 |

### 7.2 三层描摹：轮廓 + 材质分区

参考图里的每一枚棋子都不是单色剪影，而是"主材质 + 对比材质 + 金饰"的组合
（浅色方是象牙与牛血红，深色方是黑漆与骨白）。所以每枚棋子输出三层：

| 层 | 来源 | 作用 |
| --- | --- | --- |
| `silhouette` | 整个形体 | 实心的主体，填 `--piece-*-fill`，描边用 `--piece-*-edge` |
| `panel` | 主材质之外的对比材质分区 | 覆盖在主体上，填 `--piece-*-panel` |
| `trim` | 金色部分（部分棋子没有） | 覆盖在最上层，填 `--piece-*-trim` |

分区流程：

1. 先把像素按**色相**分类（红 / 金 / 中性），中性再按亮度分成亮与暗 ——
   这样比直接做 RGB 聚类稳健得多，不会把明暗当成材质；
2. 用半径 9 像素的"软多数"滤波（对每个分区的掩膜做均值模糊后取最大值）去掉噪点，
   同时保留真实边界；
3. 每个分区只保留面积 ≥ 1.2% 的连通块，并且**先对主体掩膜做 3 像素腐蚀再取交集**，
   保证分区永远不会溢出到轮廓之外；
4. 主体与分区各自用 potrace 描摹，并各自与源掩膜求 IoU 验收。

`silhouette` 永远是完整形体，所以即使分区判断有偏差，棋子依旧是实心的，
只是花纹位置略有出入。实测：

| 阵营 | 棋子 | 主体 IoU | 对比材质占比 (IoU) | 金饰占比 (IoU) |
| --- | --- | --- | --- | --- |
| 浅色 | 王 | 0.992 | 23% (0.961) | 7% (0.935) |
| 浅色 | 后 | 0.973 | 10% (0.941) | 6% (0.957) |
| 浅色 | 象 | 0.988 | 22% (0.954) | 7% (0.960) |
| 浅色 | 马 | 0.985 | 18% (0.949) | 4% (0.956) |
| 浅色 | 车 | 0.964 | 3% (0.936) | — |
| 浅色 | 兵 | 0.992 | 15% (0.960) | 5% (0.935) |
| 深色 | 王 | 0.962 | 27% (0.911) | 7% (0.938) |
| 深色 | 后 | 0.970 | 60% (0.929) | 20% (0.951) |
| 深色 | 象 | 0.974 | 41% (0.933) | 6% (0.930) |
| 深色 | 马 | 0.967 | 50% (0.921) | 12% (0.953) |
| 深色 | 车 | 0.955 | 36% (0.859) | 8% (0.937) |
| 深色 | 兵 | 0.970 | 62% (0.879) | 8% (0.942) |

### 7.3 材质角色为什么这样分配

参考图里浅色方以牛血红为主、深色方以黑漆为主。但棋盘上深格本身就是牛血红，
若照搬"牛血红作主体"，棋子在深格上会糊成一片。所以皮肤沿用国际象棋的惯例
（浅色方以象牙为主、深色方以黑漆为主），把参考图的两种材质**互换主次**：
图案结构、分区位置、金饰分布完全来自参考图，只是谁做底色、谁做花纹对调，
这样棋子在深浅两种格子上都清晰。对照表见 `design/pieces-pattern.png`。

### 7.4 列顺序是怎么定的

照片本身没有标注，所以列到棋子名称的对应关系由三条独立证据交叉确认：

1. **形状标签**：用 macOS Vision 对每格做离线分类，第 4 列（索引 3）在两行都返回
   *horse*，第 5 列（索引 4）返回 *tower / lighthouse / building*，第 3 列（索引 2）
   返回 *hat + headgear + tool*（象的冠帽与权杖）。
2. **高度排序**：第 1 列在两行里都最高，第 6 列都最矮。
3. **常规排布**：按价值排序 king, queen, bishop, knight, rook, pawn。

三条都指向同一答案：`王 · 后 · 象 · 马 · 车 · 兵`。脚本里 `ORDER` 就是这一行，
如果以后换参考图，只需要改这一个常量。

### 7.5 与皮肤系统的接口

- 两行是两套**不同**的形体，所以几何按阵营分开存放：`PIECE_GEOMETRY.w` / `PIECE_GEOMETRY.b`，
  `PieceGlyph` 按 `color` 取用；
- 每枚棋子是一个 `PieceShape`：`silhouette` 必有，`panel` / `trim` 视参考图而定；
- 路径本身不带颜色，三层各自读皮肤变量
  （`--piece-light-fill` / `-panel` / `-trim` / `-edge`，深色方同理），
  所以同一套形体可以穿任意材质；标准棋子不走这条路径，直接以文件渲染；
- 每层都可能有多个轮廓（眼睛、镂空），因此 `.piece-layer` 必须 `fill-rule: evenodd`；
- 描边只画在主体上（`stroke-width: 2.6`），承担"棋子在深浅格上都清晰"的职责；
- 第 4 节的棋子对比度验收只针对 `carved` 皮肤（标准棋子是成品文件，不读配色）：
  主体 / 对比材质 / 金饰 / 描边四者中至少一个与格子对比度 ≥ 3，
  并且对比材质与金饰相对主体至少 1.15，保证花纹看得见。

### 7.6 重新生成

```sh
python3 -m venv /tmp/vecenv
/tmp/vecenv/bin/pip install pillow numpy potracer
/tmp/vecenv/bin/python scripts/extract-chess-set-pieces.py
npm run design:skins
```

`potracer` 是 potrace 的纯 Python 版本，不在 npm 工具链里，所以提取这一步是手动的、
只在参考图更新时运行；它会直接重写 `src/lib/pieceGeometry.ts`（约 83 KB）。
`npm run design:skins` 会同时生成棋盘对照表 `design/skins-preview.html|png`
和放大的棋子花纹表 `design/pieces-pattern.html|png`。
