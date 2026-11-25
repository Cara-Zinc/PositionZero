import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const sourceDirectory = resolve("design/extracted-clker-chess");
const outputDirectory = resolve(process.argv[2] || "design/bishop-variant-a");
const basePath = "M40 67C44 72 56 72 60 67L64 77 76 83C80 85 82 88 82 93H18C18 88 20 85 24 83L36 77Z";
const verticalScale = 0.92;

function build(color, y, fill) {
  const source = readFileSync(resolve(sourceDirectory, `${color}-bishop.svg`), "utf8");
  const group = source.match(/<g\b[^>]*>[\s\S]*?<\/g>/)?.[0];
  if (!group) throw new Error(`Could not find bishop group in ${color}-bishop.svg`);

  const x = 101.64;
  const size = 49.18;
  const clipBottom = y + size * 0.72;
  const baseline = y + size * 0.95;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="${x} ${y} ${size} ${size}" role="img" aria-label="${color} bishop">
  <defs>
    <clipPath id="bishop-top-${color}" clipPathUnits="userSpaceOnUse">
      <rect x="${x}" y="${y}" width="${size}" height="${clipBottom - y}" />
    </clipPath>
  </defs>
  <g transform="translate(0 ${baseline}) scale(1 ${verticalScale}) translate(0 ${-baseline})">
    <g clip-path="url(#bishop-top-${color})">
      ${group}
    </g>
    <g transform="translate(${x} ${y})">
      <g transform="scale(${size / 100})">
        <path d="${basePath}" fill="${fill}" stroke="#000" stroke-width="3.7" stroke-linejoin="round" />
      </g>
    </g>
  </g>
</svg>
`;
}

mkdirSync(outputDirectory, { recursive: true });
writeFileSync(resolve(outputDirectory, "white-bishop.svg"), build("white", 999.9, "#fff"));
writeFileSync(resolve(outputDirectory, "black-bishop.svg"), build("black", 655.64, "#000"));
console.log(`Wrote bishop variant A to ${outputDirectory}`);
