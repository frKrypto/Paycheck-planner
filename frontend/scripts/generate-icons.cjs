/**
 * Pure-JS PNG icon generator.
 * Generates icon-192.png and icon-512.png — green circle with white "$".
 * No external dependencies; uses only Node.js built-ins (zlib, buffer).
 */

const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crcInput = Buffer.concat([typeBytes, data]);
  const crcVal = Buffer.alloc(4);
  crcVal.writeUInt32BE(crc32(crcInput));
  return Buffer.concat([len, typeBytes, data, crcVal]);
}

function generatePNG(size) {
  // Create RGBA pixel buffer
  const pixels = Buffer.alloc(size * size * 4, 0);
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.42;
  const radiusSq = radius * radius;

  // Colors
  const bgR = 0x2d, bgG = 0x8a, bgB = 0x5e; // theme green #2d8a5e
  const fgR = 0xff, fgG = 0xff, fgB = 0xff; // white

  // Draw filled circle
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const distSq = dx * dx + dy * dy;
      const idx = (y * size + x) * 4;
      if (distSq <= radiusSq) {
        pixels[idx] = bgR;
        pixels[idx + 1] = bgG;
        pixels[idx + 2] = bgB;
        pixels[idx + 3] = 255;
      }
    }
  }

  // Draw "$" symbol using a simple pixel pattern
  // Define the "$" glyph at a scale relative to icon size
  const glyphScale = size / 192;
  const glyphW = Math.round(36 * glyphScale);
  const glyphH = Math.round(60 * glyphScale);
  const gx0 = Math.round(cx - glyphW / 2);
  const gy0 = Math.round(cy - glyphH / 2);

  // "$" pixel pattern (relative coords within glyph box)
  // This is a 18x30 pattern scaled to fit
  const dollarPattern = [
    // Column pattern: each row is a bitmask of pixels to fill (1=white)
    // Top bar
    [0,1],[1,1],[2,1],[3,1],[4,1],[5,1],[6,1],[7,1],[8,1],[9,1],[10,1],[11,1],[12,1],[13,1],[14,1],[15,1],
    // S-curve top
    [15,2],[15,3],
    [14,4],[14,5],
    [13,6],[13,7],
    [12,8],
    [11,9],
    // Middle bar
    [0,10],[1,10],[2,10],[3,10],[4,10],[5,10],[6,10],[7,10],[8,10],[9,10],[10,10],[11,10],[12,10],[13,10],[14,10],[15,10],
    // S-curve bottom
    [4,11],
    [3,12],
    [2,13],[2,14],
    [1,15],[1,16],
    [0,17],[0,18],[0,19],
    // Bottom bar
    [0,20],[1,20],[2,20],[3,20],[4,20],[5,20],[6,20],[7,20],[8,20],[9,20],[10,20],[11,20],[12,20],[13,20],[14,20],[15,20],
    // Vertical bar left
    [3,2],[3,3],[3,4],[3,5],[3,6],[3,7],[3,8],
    // Vertical bar right  
    [12,12],[12,13],[12,14],[12,15],[12,16],[12,17],[12,18],
  ];

  // Scale the pattern
  const scaleX = glyphW / 16;
  const scaleY = glyphH / 21;

  for (const [rx, ry] of dollarPattern) {
    const px = Math.round(rx * scaleX);
    const py = Math.round(ry * scaleY);
    // Fill a small block for each pattern point
    const bw = Math.max(1, Math.round(scaleX * 0.7));
    const bh = Math.max(1, Math.round(scaleY * 0.7));
    for (let dy = 0; dy < bh; dy++) {
      for (let dx = 0; dx < bw; dx++) {
        const ax = gx0 + px + dx;
        const ay = gy0 + py + dy;
        if (ax >= 0 && ax < size && ay >= 0 && ay < size) {
          const idx = (ay * size + ax) * 4;
          pixels[idx] = fgR;
          pixels[idx + 1] = fgG;
          pixels[idx + 2] = fgB;
          pixels[idx + 3] = 255;
        }
      }
    }
  }

  // Build PNG
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);  // width
  ihdr.writeUInt32BE(size, 4);  // height
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type (RGBA)
  ihdr[10] = 0;  // compression
  ihdr[11] = 0;  // filter
  ihdr[12] = 0;  // interlace

  // IDAT: raw image data with filter byte 0 per row
  const rawData = Buffer.alloc(size * (1 + size * 4));
  for (let y = 0; y < size; y++) {
    rawData[y * (1 + size * 4)] = 0; // filter: none
    pixels.copy(rawData, y * (1 + size * 4) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const compressed = zlib.deflateSync(rawData);

  const png = Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);

  return png;
}

// Generate both sizes
const outDir = path.join(__dirname, '..', 'public');

[192, 512].forEach(size => {
  const png = generatePNG(size);
  const filePath = path.join(outDir, `icon-${size}.png`);
  fs.writeFileSync(filePath, png);
  console.log(`Generated ${filePath} (${png.length} bytes)`);
});

console.log('Icons generated successfully.');
