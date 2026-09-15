// Génère les icônes PWA Takata Kwetu (SVG -> PNG) via sharp
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const outDir = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(outDir, { recursive: true });

// Logo Takata Kwetu : carré arrondi vert dégradé + éclair blanc (énergie)
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#16A34A"/>
      <stop offset="100%" stop-color="#15803D"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="url(#g)"/>
  <path d="M292 96 L168 292 h76 l-24 124 L344 220 h-76 z" fill="#FFFFFF"/>
</svg>`;

async function main() {
  await sharp(Buffer.from(svg)).png().toFile(path.join(outDir, 'icon-512.png'));
  await sharp(Buffer.from(svg)).resize(192, 192).png().toFile(path.join(outDir, 'icon-192.png'));
  await sharp(Buffer.from(svg)).resize(180, 180).png().toFile(path.join(outDir, 'apple-touch-icon.png'));
  await sharp(Buffer.from(svg)).resize(64, 64).png().toFile(path.join(outDir, 'favicon.png'));
  // favicon.ico simple (PNG converti)
  await sharp(Buffer.from(svg)).resize(32, 32).png().toFile(path.join(outDir, 'favicon-32.png'));
  console.log('Icônes générées:', fs.readdirSync(outDir).join(', '));
}

main().catch(e => { console.error(e); process.exit(1); });