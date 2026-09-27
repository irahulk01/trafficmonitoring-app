const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const screenshotsDir = path.join(__dirname, '../public/screenshots');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

function createDesktopScreenshotSvg() {
  return `<svg width="1280" height="720" viewBox="0 0 1280 720" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#0b0f19" />
        <stop offset="100%" stop-color="#020617" />
      </linearGradient>
      <linearGradient id="cardGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#1e293b" stop-opacity="0.8" />
        <stop offset="100%" stop-color="#0f172a" stop-opacity="0.9" />
      </linearGradient>
      <linearGradient id="accentCyan" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#06b6d4" />
        <stop offset="100%" stop-color="#3b82f6" />
      </linearGradient>
    </defs>
    <rect width="1280" height="720" fill="url(#bg)" />

    <!-- Top Navigation Bar -->
    <rect x="0" y="0" width="1280" height="64" fill="#0f172a" fill-opacity="0.95" />
    <line x1="0" y1="64" x2="1280" y2="64" stroke="#1e293b" stroke-width="1" />
    
    <!-- App Logo & Title -->
    <circle cx="48" cy="32" r="18" fill="url(#accentCyan)" />
    <text x="78" y="38" fill="#f8fafc" font-family="system-ui, -apple-system, sans-serif" font-weight="700" font-size="18">TrafficFlow Live</text>
    <rect x="230" y="22" width="70" height="22" rx="11" fill="#10b981" fill-opacity="0.2" stroke="#10b981" stroke-width="1" />
    <circle cx="242" cy="33" r="4" fill="#10b981" />
    <text x="252" y="37" fill="#34d399" font-family="system-ui, sans-serif" font-size="11" font-weight="600">LIVE SYNC</text>

    <!-- Top Right Badges -->
    <rect x="1100" y="18" width="140" height="30" rx="15" fill="#38bdf8" fill-opacity="0.15" stroke="#38bdf8" stroke-width="1" />
    <text x="1170" y="37" fill="#38bdf8" font-family="system-ui, sans-serif" font-size="12" font-weight="600" text-anchor="middle">PWA Standalone</text>

    <!-- Stat Cards Row -->
    <g transform="translate(48, 88)">
      <rect x="0" y="0" width="275" height="100" rx="16" fill="url(#cardGrad)" stroke="#334155" stroke-width="1" />
      <text x="20" y="34" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="12" font-weight="600">MONITORED SEGMENTS</text>
      <text x="20" y="74" fill="#38bdf8" font-family="system-ui, sans-serif" font-size="32" font-weight="700">12 Segments</text>

      <rect x="303" y="0" width="275" height="100" rx="16" fill="url(#cardGrad)" stroke="#334155" stroke-width="1" />
      <text x="323" y="34" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="12" font-weight="600">ACTIVE INCIDENTS</text>
      <text x="323" y="74" fill="#f43f5e" font-family="system-ui, sans-serif" font-size="32" font-weight="700">3 Alerts</text>

      <rect x="606" y="0" width="275" height="100" rx="16" fill="url(#cardGrad)" stroke="#334155" stroke-width="1" />
      <text x="626" y="34" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="12" font-weight="600">AVERAGE DELAY</text>
      <text x="626" y="74" fill="#fbbf24" font-family="system-ui, sans-serif" font-size="32" font-weight="700">+4.2 min</text>

      <rect x="909" y="0" width="275" height="100" rx="16" fill="url(#cardGrad)" stroke="#334155" stroke-width="1" />
      <text x="929" y="34" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="12" font-weight="600">NETWORK HEALTH</text>
      <text x="929" y="74" fill="#34d399" font-family="system-ui, sans-serif" font-size="32" font-weight="700">98.4% Optimal</text>
    </g>

    <!-- Map & Feed Container -->
    <g transform="translate(48, 212)">
      <!-- Map viewport simulation -->
      <rect x="0" y="0" width="760" height="470" rx="20" fill="#0f172a" stroke="#1e293b" stroke-width="1.5" />
      
      <!-- Simulated map grid & routes -->
      <path d="M 60 100 Q 200 80 380 200 T 700 350" fill="none" stroke="#10b981" stroke-width="6" stroke-linecap="round" />
      <path d="M 120 400 Q 300 280 480 300 T 720 180" fill="none" stroke="#f59e0b" stroke-width="8" stroke-linecap="round" />
      <path d="M 380 80 L 380 400" fill="none" stroke="#ef4444" stroke-width="8" stroke-linecap="round" />
      
      <!-- Incident markers -->
      <circle cx="380" cy="220" r="14" fill="#ef4444" fill-opacity="0.3" />
      <circle cx="380" cy="220" r="8" fill="#ef4444" />
      <circle cx="480" cy="300" r="12" fill="#f59e0b" fill-opacity="0.3" />
      <circle cx="480" cy="300" r="7" fill="#f59e0b" />

      <!-- Map overlay badge -->
      <rect x="24" y="24" width="180" height="38" rx="10" fill="#020617" fill-opacity="0.8" stroke="#334155" stroke-width="1" />
      <text x="36" y="48" fill="#e2e8f0" font-family="system-ui, sans-serif" font-size="13" font-weight="600">TomTom Live Vector Map</text>

      <!-- Incident sidebar container -->
      <rect x="784" y="0" width="400" height="470" rx="20" fill="url(#cardGrad)" stroke="#1e293b" stroke-width="1.5" />
      <text x="808" y="38" fill="#f8fafc" font-family="system-ui, sans-serif" font-size="16" font-weight="700">Live Congestion Feed</text>
      
      <!-- List Items -->
      <rect x="808" y="58" width="352" height="74" rx="12" fill="#0b0f19" stroke="#334155" stroke-width="1" />
      <circle cx="828" cy="85" r="5" fill="#ef4444" />
      <text x="844" y="80" fill="#f1f5f9" font-family="system-ui, sans-serif" font-size="13" font-weight="600">MG Road Corridor — Severe Delay</text>
      <text x="844" y="100" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="11">Current Speed: 8 km/h • Free Flow: 45 km/h</text>

      <rect x="808" y="142" width="352" height="74" rx="12" fill="#0b0f19" stroke="#334155" stroke-width="1" />
      <circle cx="828" cy="169" r="5" fill="#f59e0b" />
      <text x="844" y="164" fill="#f1f5f9" font-family="system-ui, sans-serif" font-size="13" font-weight="600">Outer Ring Road — Moderate Flow</text>
      <text x="844" y="184" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="11">Current Speed: 24 km/h • Free Flow: 50 km/h</text>

      <rect x="808" y="226" width="352" height="74" rx="12" fill="#0b0f19" stroke="#334155" stroke-width="1" />
      <circle cx="828" cy="253" r="5" fill="#10b981" />
      <text x="844" y="248" fill="#f1f5f9" font-family="system-ui, sans-serif" font-size="13" font-weight="600">Airport Expressway — Smooth</text>
      <text x="844" y="268" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="11">Current Speed: 78 km/h • Free Flow: 80 km/h</text>
    </g>
  </svg>`;
}

function createMobileScreenshotSvg() {
  return `<svg width="400" height="800" viewBox="0 0 400 800" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="mbg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#0b0f19" />
        <stop offset="100%" stop-color="#020617" />
      </linearGradient>
      <linearGradient id="mcard" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#1e293b" />
        <stop offset="100%" stop-color="#0f172a" />
      </linearGradient>
    </defs>
    <rect width="400" height="800" fill="url(#mbg)" />

    <!-- Top Header -->
    <rect x="0" y="0" width="400" height="60" fill="#0f172a" />
    <circle cx="30" cy="30" r="14" fill="#06b6d4" />
    <text x="54" y="35" fill="#f8fafc" font-family="system-ui, sans-serif" font-weight="700" font-size="16">TrafficFlow</text>
    <circle cx="360" cy="30" r="4" fill="#10b981" />
    <text x="345" y="34" fill="#34d399" font-family="system-ui, sans-serif" font-size="11" text-anchor="end">LIVE</text>

    <!-- Top Cards Grid -->
    <g transform="translate(16, 76)">
      <rect x="0" y="0" width="176" height="74" rx="12" fill="url(#mcard)" stroke="#334155" stroke-width="1" />
      <text x="12" y="26" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="10" font-weight="600">SEGMENTS</text>
      <text x="12" y="56" fill="#38bdf8" font-family="system-ui, sans-serif" font-size="22" font-weight="700">12 Active</text>

      <rect x="192" y="0" width="176" height="74" rx="12" fill="url(#mcard)" stroke="#334155" stroke-width="1" />
      <text x="204" y="26" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="10" font-weight="600">INCIDENTS</text>
      <text x="204" y="56" fill="#f43f5e" font-family="system-ui, sans-serif" font-size="22" font-weight="700">3 Alerts</text>
    </g>

    <!-- Map Preview -->
    <rect x="16" y="166" width="368" height="280" rx="16" fill="#0f172a" stroke="#1e293b" stroke-width="1" />
    <path d="M 40 220 Q 180 200 260 290 T 360 380" fill="none" stroke="#10b981" stroke-width="5" stroke-linecap="round" />
    <path d="M 60 360 Q 200 300 340 220" fill="none" stroke="#ef4444" stroke-width="6" stroke-linecap="round" />
    <circle cx="200" cy="300" r="12" fill="#ef4444" fill-opacity="0.3" />
    <circle cx="200" cy="300" r="6" fill="#ef4444" />

    <!-- Incident List -->
    <g transform="translate(16, 460)">
      <text x="4" y="18" fill="#f8fafc" font-family="system-ui, sans-serif" font-size="14" font-weight="700">Live Incident Alerts</text>
      
      <rect x="0" y="32" width="368" height="66" rx="12" fill="url(#mcard)" stroke="#334155" stroke-width="1" />
      <circle cx="20" cy="55" r="4" fill="#ef4444" />
      <text x="34" y="52" fill="#f1f5f9" font-family="system-ui, sans-serif" font-size="12" font-weight="600">MG Road Corridor — Jam</text>
      <text x="34" y="72" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="10">Speed 8 km/h • Free 45 km/h</text>

      <rect x="0" y="108" width="368" height="66" rx="12" fill="url(#mcard)" stroke="#334155" stroke-width="1" />
      <circle cx="20" cy="131" r="4" fill="#f59e0b" />
      <text x="34" y="128" fill="#f1f5f9" font-family="system-ui, sans-serif" font-size="12" font-weight="600">Outer Ring Road — Congested</text>
      <text x="34" y="148" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="10">Speed 24 km/h • Free 50 km/h</text>
    </g>

    <!-- Bottom Nav Bar -->
    <rect x="0" y="736" width="400" height="64" fill="#0f172a" />
    <line x1="0" y1="736" x2="400" y2="736" stroke="#1e293b" stroke-width="1" />
    <circle cx="80" cy="764" r="10" fill="#38bdf8" />
    <circle cx="200" cy="764" r="10" fill="#64748b" />
    <circle cx="320" cy="764" r="10" fill="#64748b" />
  </svg>`;
}

async function generateScreenshots() {
  await sharp(Buffer.from(createDesktopScreenshotSvg())).png().toFile(path.join(screenshotsDir, 'screenshot-desktop.png'));
  await sharp(Buffer.from(createMobileScreenshotSvg())).png().toFile(path.join(screenshotsDir, 'screenshot-mobile.png'));
  console.log('Generated desktop and mobile screenshots!');
}

generateScreenshots().catch(console.error);
