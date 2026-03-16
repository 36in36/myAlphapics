const sharp = require('sharp');
const path = require('path');

const src = path.join(__dirname, 'public/images/myalphapics.jpg');
const sizes = [180, 192, 512];

(async () => {
  for (const s of sizes) {
    const out = path.join(__dirname, `public/images/icon-${s}x${s}.png`);
    await sharp(src).resize(s, s).png().toFile(out);
    console.log(`Generated ${out}`);
  }
})();
