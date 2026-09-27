const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const iconsDir = path.join(__dirname, '../public/icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

function createIconSvg(size, isMaskable = false) {
  const padding = isMaskable ? size * 0.15 : size * 0.08;
  const contentSize = size - padding * 2;
  const center = size / 2;

  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="50%" stop-color="#0b0f19" />
      <stop offset="100%" stop-color="#020617" />
    </linearGradient>
    <linearGradient id="neonCyan" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="100%" stop-color="#0284c7" />
    </linearGradient>
    <linearGradient id="neonEmerald" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#34d399" />
      <stop offset="100%" stop-color="#059669" />
    </linearGradient>
    <linearGradient id="neonAmber" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fbbf24" />
      <stop offset="100%" stop-color="#d97706" />
    </linearGradient>
    <linearGradient id="neonRose" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f43f5e" />
      <stop offset="100%" stop-color="#be123c" />
    </linearGradient>
    <radialGradient id="glowGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#06b6d4" stop-opacity="0.35" />
      <stop offset="100%" stop-color="#06b6d4" stop-opacity="0" />
    </radialGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#000" flood-opacity="0.5" />
    </filter>
  </defs>

  <!-- Background -->
  ${isMaskable 
    ? `<rect width="${size}" height="${size}" fill="url(#bgGrad)" />`
    : `<rect width="${size}" height="${size}" rx="${size * 0.22}" fill="url(#bgGrad)" stroke="#1e293b" stroke-width="${size * 0.015}" />`
  }

  <!-- Ambient Glow -->
  <circle cx="${center}" cy="${center}" r="${contentSize * 0.45}" fill="url(#glowGlow)" />

  <!-- Radar Circles -->
  <circle cx="${center}" cy="${center}" r="${contentSize * 0.38}" fill="none" stroke="#334155" stroke-width="${size * 0.012}" stroke-dasharray="${size * 0.02} ${size * 0.02}" opacity="0.6" />
  <circle cx="${center}" cy="${center}" r="${contentSize * 0.26}" fill="none" stroke="#0ea5e9" stroke-width="${size * 0.015}" opacity="0.5" />
  <circle cx="${center}" cy="${center}" r="${contentSize * 0.14}" fill="none" stroke="#38bdf8" stroke-width="${size * 0.018}" opacity="0.8" />

  <!-- Highway Node Tracks -->
  <!-- Main vertical artery -->
  <path d="M ${center} ${center - contentSize * 0.38} L ${center} ${center + contentSize * 0.38}" stroke="#1e293b" stroke-width="${size * 0.04}" stroke-linecap="round" />
  <path d="M ${center} ${center - contentSize * 0.38} L ${center} ${center - contentSize * 0.05}" stroke="url(#neonCyan)" stroke-width="${size * 0.03}" stroke-linecap="round" />
  <path d="M ${center} ${center + contentSize * 0.05} L ${center} ${center + contentSize * 0.38}" stroke="url(#neonEmerald)" stroke-width="${size * 0.03}" stroke-linecap="round" />

  <!-- Curved artery left to right -->
  <path d="M ${center - contentSize * 0.35} ${center + contentSize * 0.15} C ${center - contentSize * 0.1} ${center + contentSize * 0.15}, ${center - contentSize * 0.05} ${center - contentSize * 0.15}, ${center + contentSize * 0.35} ${center - contentSize * 0.15}" 
        fill="none" stroke="url(#neonAmber)" stroke-width="${size * 0.025}" stroke-linecap="round" />

  <!-- Cross curved artery -->
  <path d="M ${center - contentSize * 0.32} ${center - contentSize * 0.2} Q ${center} ${center + contentSize * 0.1} ${center + contentSize * 0.32} ${center + contentSize * 0.25}" 
        fill="none" stroke="url(#neonRose)" stroke-width="${size * 0.02}" stroke-linecap="round" opacity="0.9" />

  <!-- Traffic Signal Beacons / Nodes -->
  <!-- Top Node -->
  <circle cx="${center}" cy="${center - contentSize * 0.35}" r="${size * 0.025}" fill="#38bdf8" filter="url(#shadow)" />
  <!-- Center Intersection Hub -->
  <circle cx="${center}" cy="${center}" r="${size * 0.05}" fill="#0f172a" stroke="#0284c7" stroke-width="${size * 0.018}" />
  <circle cx="${center}" cy="${center}" r="${size * 0.025}" fill="#38bdf8" />
  
  <!-- Right node -->
  <circle cx="${center + contentSize * 0.35}" cy="${center - contentSize * 0.15}" r="${size * 0.022}" fill="#fbbf24" />
  <!-- Left node -->
  <circle cx="${center - contentSize * 0.35}" cy="${center + contentSize * 0.15}" r="${size * 0.022}" fill="#f43f5e" />
  <!-- Bottom node -->
  <circle cx="${center}" cy="${center + contentSize * 0.35}" r="${size * 0.025}" fill="#34d399" />
</svg>`;
}

async function generateAllIcons() {
  const sizes = [
    { name: 'icon-192x192.png', size: 192, maskable: false },
    { name: 'icon-512x512.png', size: 512, maskable: false },
    { name: 'icon-maskable-192x192.png', size: 192, maskable: true },
    { name: 'icon-maskable-512x512.png', size: 512, maskable: true },
    { name: 'apple-touch-icon.png', size: 180, maskable: false },
    { name: 'favicon-32x32.png', size: 32, maskable: false },
    { name: 'favicon-16x16.png', size: 16, maskable: false },
  ];

  for (const { name, size, maskable } of sizes) {
    const svg = Buffer.from(createIconSvg(size, maskable));
    const outPath = path.join(iconsDir, name);
    await sharp(svg).png().toFile(outPath);
    console.log(`Generated: ${name} (${size}x${size}, maskable=${maskable})`);
  }

  // Also write SVG for favicon / vector use
  fs.writeFileSync(path.join(iconsDir, 'icon.svg'), createIconSvg(512, false));
  console.log('Generated: icon.svg');
}

generateAllIcons().catch(console.error);
