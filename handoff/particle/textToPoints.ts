export type SampleOptions = {
  /** Exact number of particles to return (result has count*3 floats). */
  count: number;
  /** Offscreen canvas pixel dimensions used for rasterizing the text. */
  width: number;
  height: number;
  /** Canvas font-family string (use the real generated next/font family). */
  fontFamily: string;
  /** World-space extents the canvas maps onto (from useThree viewport). */
  worldWidth: number;
  worldHeight: number;
};

/**
 * Rasterizes `text` to an offscreen canvas, reads the filled pixels, and maps
 * them to exactly `count` world-space particle positions (Float32Array, xyz).
 *
 * Using a fixed `count` for every word is what makes a clean morph possible:
 * particle i always has one home position per word, so transitions are just a
 * spring toward a new target.
 */
export function sampleTextToPoints(
  text: string,
  opts: SampleOptions
): Float32Array {
  const { count, width, height, fontFamily, worldWidth, worldHeight } = opts;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  const result = new Float32Array(count * 3);

  if (!ctx) return randomCloud(result, count, worldWidth, worldHeight);

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // Fit the font size so the word spans ~86% of the canvas width.
  let fontSize = Math.floor(height * 0.62);
  ctx.font = `${fontSize}px ${fontFamily}`;
  const maxWidth = width * 0.86;
  const measured = ctx.measureText(text).width;
  if (measured > maxWidth && measured > 0) {
    fontSize = Math.floor(fontSize * (maxWidth / measured));
    ctx.font = `${fontSize}px ${fontFamily}`;
  }
  ctx.fillText(text, width / 2, height / 2);

  const data = ctx.getImageData(0, 0, width, height).data;
  const filled: number[] = [];
  const stride = 3; // sample every N pixels — density vs. cost
  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      if (data[(y * width + x) * 4 + 3] > 128) {
        filled.push(x, y);
      }
    }
  }

  const found = filled.length / 2;
  if (found === 0) return randomCloud(result, count, worldWidth, worldHeight);

  const oversampled = found < count;
  for (let i = 0; i < count; i++) {
    let idx = Math.floor((i / count) * found);
    if (idx >= found) idx = found - 1;
    const px = filled[idx * 2];
    const py = filled[idx * 2 + 1];
    // When we have fewer pixels than particles, jitter the duplicates so they
    // don't perfectly overlap.
    const jx = oversampled ? (Math.random() - 0.5) * stride * 2 : 0;
    const jy = oversampled ? (Math.random() - 0.5) * stride * 2 : 0;

    result[i * 3] = ((px + jx) / width - 0.5) * worldWidth;
    result[i * 3 + 1] = -((py + jy) / height - 0.5) * worldHeight;
    result[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
  }
  return result;
}

function randomCloud(
  out: Float32Array,
  count: number,
  w: number,
  h: number
): Float32Array {
  for (let i = 0; i < count; i++) {
    out[i * 3] = (Math.random() - 0.5) * w;
    out[i * 3 + 1] = (Math.random() - 0.5) * h;
    out[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
  }
  return out;
}
