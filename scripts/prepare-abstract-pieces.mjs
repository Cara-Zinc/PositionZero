import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Mechanical sprite extraction only; retain the approved ImageGen artwork.
const sharpPath = process.argv[2];
if (!sharpPath) throw new Error('Pass the installed sharp package.json path.');
const sharp = createRequire(sharpPath)('sharp');
const root = fileURLToPath(new URL('../', import.meta.url));
const { data, info } = await sharp(root + 'design/porcelain-abstract-v2/concept.png').raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;
if (channels !== 4) throw new Error('The source must have genuine alpha.');
const labels = new Int32Array(width * height);
const components = [];
let id = 0;
for (let p = 0; p < labels.length; p++) {
  if (labels[p] || data[p * 4 + 3] < 32) continue;
  id++;
  const queue = [p];
  labels[p] = id;
  let count = 0, left = width, right = 0, top = height, bottom = 0;
  while (queue.length) {
    const q = queue.pop(), x = q % width, y = Math.floor(q / width);
    count++;
    left = Math.min(left, x); right = Math.max(right, x);
    top = Math.min(top, y); bottom = Math.max(bottom, y);
    for (const next of [x ? q - 1 : -1, x < width - 1 ? q + 1 : -1, y ? q - width : -1, y < height - 1 ? q + width : -1]) {
      if (next < 0 || labels[next] || data[next * 4 + 3] < 32) continue;
      labels[next] = id;
      queue.push(next);
    }
  }
  if (count > 1000) components.push({ id, count, left, right, top, bottom });
}
const rows = [components.filter(c => c.top < height / 2), components.filter(c => c.top >= height / 2)];
if (rows.some(row => row.length !== 6)) throw new Error('Expected two rows of six independent pieces.');
const roles = ['king', 'queen', 'bishop', 'knight', 'rook', 'pawn'];
const heights = [430, 420, 400, 385, 365, 350];
const manifest = [];
for (const target of ['design/porcelain-abstract-v2/pieces', 'public/pieces/red-black']) await mkdir(root + target, { recursive: true });
for (const [rowIndex, row] of rows.entries()) {
  row.sort((a, b) => a.left - b.left);
  for (const [column, component] of row.entries()) {
    const left = Math.max(0, component.left - 3), top = Math.max(0, component.top - 3);
    const w = Math.min(width, component.right + 4) - left, h = Math.min(height, component.bottom + 4) - top;
    const crop = Buffer.alloc(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = (top + y) * width + left + x;
      let belongs = labels[p] === component.id;
      // Keep the source's antialiased fringe, excluding neighbouring figures.
      if (!labels[p] && data[p * 4 + 3]) {
        for (let dy = -2; dy <= 2 && !belongs; dy++) for (let dx = -2; dx <= 2; dx++) {
          const nx = left + x + dx, ny = top + y + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height && labels[ny * width + nx] === component.id) belongs = true;
        }
      }
      if (belongs) data.copy(crop, (y * w + x) * 4, p * 4, p * 4 + 4);
    }
    const resized = await sharp(crop, { raw: { width: w, height: h, channels: 4 } }).resize({ width: 430, height: heights[column], fit: 'inside' }).png().toBuffer();
    const size = await sharp(resized).metadata();
    const sprite = await sharp({ create: { width: 512, height: 512, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: resized, left: Math.round((512 - size.width) / 2), top: 475 - size.height }]).png().toBuffer();
    const file = `${rowIndex ? 'black' : 'white'}-${roles[column]}.png`;
    for (const target of ['design/porcelain-abstract-v2/pieces', 'public/pieces/red-black']) await writeFile(root + target + '/' + file, sprite);
    const packed = await sharp(sprite).raw().toBuffer();
    for (let i = 0; i < 512; i++) for (const p of [i, 511 * 512 + i, i * 512, i * 512 + 511]) if (packed[p * 4 + 3]) throw new Error('Clipped edge: ' + file);
    manifest.push({ file, source: component, canvas: 512, baseline: 475, visibleWidth: size.width, visibleHeight: size.height });
  }
}
await writeFile(root + 'design/porcelain-abstract-v2/pieces/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
console.log('PASS: extracted and synced 12 RGBA 512px pieces with transparent margins.');
