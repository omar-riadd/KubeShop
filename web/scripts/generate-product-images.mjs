import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outDir = path.resolve(__dirname, '../public/images/products');
fs.mkdirSync(outDir, { recursive: true });

const products = [
  {
    id: 'kb-001',
    name: 'Nimbus 75 Mechanical Keyboard',
    category: 'Keyboards',
    tag: '75% HOT-SWAP · GASKET MOUNT',
    accent: '#3b82f6',
    secondary: '#60a5fa',
    bgStart: '#0f172a',
    bgEnd: '#1e293b',
    badge: 'FLAGSHIP',
    render: (c1, c2) => `
      <!-- Keyboard Chassis -->
      <filter id="shadow-kb" x="-10%" y="-10%" width="120%" height="130%">
        <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="${c1}" flood-opacity="0.25"/>
      </filter>
      <!-- Desk Glow -->
      <ellipse cx="200" cy="160" rx="150" ry="60" fill="${c1}" opacity="0.15" filter="blur(20px)"/>
      <!-- Main Case -->
      <g filter="url(#shadow-kb)">
        <rect x="70" y="85" width="260" height="130" rx="14" fill="#090d16" stroke="#334155" stroke-width="2"/>
        <rect x="74" y="89" width="252" height="122" rx="10" fill="#0f172a" stroke="#1e293b" stroke-width="1.5"/>
        <rect x="78" y="93" width="244" height="114" rx="8" fill="#131b2e"/>
      </g>
      <!-- Rotary Volume Knob -->
      <circle cx="305" cy="110" r="11" fill="url(#knob-grad)" stroke="${c1}" stroke-width="1.5"/>
      <circle cx="305" cy="110" r="8" fill="#0b1120"/>
      <line x1="305" y1="102" x2="305" y2="106" stroke="${c2}" stroke-width="2" stroke-linecap="round"/>
      <!-- Esc Key (Accent) -->
      <rect x="85" y="100" width="16" height="14" rx="3" fill="${c1}"/>
      <text x="93" y="110" font-family="monospace" font-size="7" font-weight="bold" fill="#ffffff" text-anchor="middle">ESC</text>
      <!-- Function Row -->
      ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
        .map(
          (i) => `
        <rect x="${107 + i * 18}" y="100" width="14" height="14" rx="3" fill="#1e293b" stroke="#334155" stroke-width="0.8"/>
      `
        )
        .join('')}
      <!-- Alpha Rows -->
      ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
        .map(
          (i) => `
        <rect x="${85 + i * 17}" y="118" width="14" height="14" rx="3" fill="${i % 3 === 0 ? '#1e293b' : '#0f172a'}" stroke="#334155" stroke-width="0.8"/>
      `
        )
        .join('')}
      ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
        .map(
          (i) => `
        <rect x="${88 + i * 18}" y="136" width="15" height="14" rx="3" fill="${i === 0 || i === 10 ? c1 : '#1e293b'}" stroke="#334155" stroke-width="0.8" opacity="${i === 0 || i === 10 ? '0.85' : '1'}"/>
      `
        )
        .join('')}
      ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
        .map(
          (i) => `
        <rect x="${92 + i * 19}" y="154" width="16" height="14" rx="3" fill="#1e293b" stroke="#334155" stroke-width="0.8"/>
      `
        )
        .join('')}
      <!-- Bottom Row with Spacebar -->
      <rect x="85" y="172" width="22" height="14" rx="3" fill="#1e293b" stroke="#334155" stroke-width="0.8"/>
      <rect x="111" y="172" width="18" height="14" rx="3" fill="#1e293b" stroke="#334155" stroke-width="0.8"/>
      <rect x="133" y="172" width="18" height="14" rx="3" fill="#1e293b" stroke="#334155" stroke-width="0.8"/>
      <rect x="155" y="172" width="90" height="14" rx="3" fill="url(#spacebar-grad)" stroke="${c1}" stroke-width="1.2"/>
      <rect x="249" y="172" width="18" height="14" rx="3" fill="#1e293b" stroke="#334155" stroke-width="0.8"/>
      <!-- Arrow Cluster -->
      <rect x="290" y="172" width="14" height="14" rx="3" fill="${c1}"/>
      <path d="M297 176 L294 182 L300 182 Z" fill="#ffffff"/>
      <rect x="274" y="172" width="14" height="14" rx="3" fill="#1e293b" stroke="#334155" stroke-width="0.8"/>
      <rect x="306" y="172" width="14" height="14" rx="3" fill="#1e293b" stroke="#334155" stroke-width="0.8"/>
      <rect x="290" y="154" width="14" height="14" rx="3" fill="#1e293b" stroke="#334155" stroke-width="0.8"/>
    `,
  },
  {
    id: 'kb-002',
    name: 'Helm 60 Wireless Keyboard',
    category: 'Keyboards',
    tag: '60% COMPACT · 2.4GHZ & BLUETOOTH',
    accent: '#06b6d4',
    secondary: '#38bdf8',
    bgStart: '#082f49',
    bgEnd: '#0f172a',
    badge: 'WIRELESS',
    render: (c1, c2) => `
      <ellipse cx="200" cy="155" rx="140" ry="55" fill="${c1}" opacity="0.18" filter="blur(22px)"/>
      <!-- Sleek Angled Minimal Case -->
      <g filter="drop-shadow(0 14px 20px rgba(6, 182, 212, 0.2))">
        <rect x="80" y="90" width="240" height="115" rx="12" fill="#030712" stroke="#164e63" stroke-width="2"/>
        <rect x="84" y="94" width="232" height="107" rx="8" fill="#082f49" stroke="#0e7490" stroke-width="1"/>
      </g>
      <!-- Neon Wireless Status Bar -->
      <line x1="88" y1="92" x2="312" y2="92" stroke="${c1}" stroke-width="2" stroke-linecap="round" opacity="0.8"/>
      <circle cx="304" cy="102" r="3" fill="${c2}"/>
      <!-- Minimal Keycaps Grid (60%) -->
      ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
        .map(
          (i) => `
        <rect x="${92 + i * 18}" y="104" width="15" height="14" rx="3" fill="${i === 0 ? c1 : '#0c4a6e'}" stroke="#155e75" stroke-width="0.8"/>
      `
        )
        .join('')}
      ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
        .map(
          (i) => `
        <rect x="${92 + i * 18}" y="122" width="15" height="14" rx="3" fill="#075985" stroke="#0284c7" stroke-width="0.8" opacity="0.9"/>
      `
        )
        .join('')}
      ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
        .map(
          (i) => `
        <rect x="${95 + i * 19}" y="140" width="16" height="14" rx="3" fill="#0c4a6e" stroke="#155e75" stroke-width="0.8"/>
      `
        )
        .join('')}
      <!-- Long Cyan Spacebar -->
      <rect x="92" y="158" width="22" height="15" rx="3" fill="#0369a1"/>
      <rect x="118" y="158" width="20" height="15" rx="3" fill="#0c4a6e"/>
      <rect x="142" y="158" width="116" height="15" rx="4" fill="url(#spacebar-cyan)" stroke="${c1}" stroke-width="1.5"/>
      <rect x="262" y="158" width="20" height="15" rx="3" fill="#0c4a6e"/>
      <rect x="286" y="158" width="22" height="15" rx="3" fill="#0369a1"/>
    `,
  },
  {
    id: 'kb-003',
    name: 'Pod TKL Low-Profile Keyboard',
    category: 'Keyboards',
    tag: 'TKL · ULTRA-SLIM ERGONOMIC',
    accent: '#6366f1',
    secondary: '#818cf8',
    bgStart: '#1e1b4b',
    bgEnd: '#0f172a',
    badge: 'LOW PROFILE',
    render: (c1, c2) => `
      <ellipse cx="200" cy="155" rx="145" ry="50" fill="${c1}" opacity="0.16" filter="blur(20px)"/>
      <!-- Ultra-thin Aluminium Body -->
      <g filter="drop-shadow(0 12px 18px rgba(99, 102, 241, 0.22))">
        <rect x="65" y="95" width="270" height="105" rx="8" fill="#0f0f23" stroke="#312e81" stroke-width="2"/>
        <rect x="68" y="98" width="264" height="99" rx="6" fill="#181838"/>
      </g>
      <!-- Beveled Chamfer Edge -->
      <line x1="68" y1="98" x2="332" y2="98" stroke="#4338ca" stroke-width="1.5"/>
      <!-- Chiclet Keycaps -->
      ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
        .map(
          (i) => `
        <rect x="${76 + i * 19}" y="106" width="16" height="12" rx="2.5" fill="#2e2b69" stroke="#4338ca" stroke-width="0.8"/>
      `
        )
        .join('')}
      ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
        .map(
          (i) => `
        <rect x="${76 + i * 19}" y="122" width="16" height="12" rx="2.5" fill="${i === 0 ? c1 : '#1e1b4b'}" stroke="#3730a3" stroke-width="0.8"/>
      `
        )
        .join('')}
      ${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
        .map(
          (i) => `
        <rect x="${80 + i * 20}" y="138" width="17" height="12" rx="2.5" fill="#2e2b69" stroke="#4338ca" stroke-width="0.8"/>
      `
        )
        .join('')}
      <!-- Low profile Spacebar and Navigation Block -->
      <rect x="76" y="154" width="24" height="13" rx="2.5" fill="#312e81"/>
      <rect x="104" y="154" width="128" height="13" rx="3" fill="${c1}" opacity="0.9"/>
      <rect x="236" y="154" width="24" height="13" rx="2.5" fill="#312e81"/>
      <!-- TKL Cluster Keys -->
      <rect x="268" y="154" width="18" height="13" rx="2.5" fill="#4338ca"/>
      <rect x="290" y="154" width="18" height="13" rx="2.5" fill="#4338ca"/>
      <rect x="312" y="154" width="18" height="13" rx="2.5" fill="${c2}"/>
    `,
  },
  {
    id: 'ms-001',
    name: 'Orbit Ergonomic Mouse',
    category: 'Mice',
    tag: '4000HZ POLLING · PAW3395 SENSOR',
    accent: '#10b981',
    secondary: '#34d399',
    bgStart: '#064e3b',
    bgEnd: '#0f172a',
    badge: 'POPULAR',
    render: (c1, c2) => `
      <ellipse cx="200" cy="155" rx="80" ry="75" fill="${c1}" opacity="0.2" filter="blur(24px)"/>
      <g filter="drop-shadow(0 14px 22px rgba(16, 185, 129, 0.25))">
        <!-- Ergonomic Palm Contour with Thumb Wing -->
        <path d="M 170,85 C 190,80 220,85 235,105 C 248,122 250,155 245,185 C 240,205 220,225 195,225 C 170,225 155,210 150,185 C 142,165 140,150 148,135 C 153,125 155,115 160,100 Z" fill="#06281e" stroke="#059669" stroke-width="2"/>
        <!-- Textured Thumb Rest Flare -->
        <path d="M 150,145 C 135,160 135,185 148,195 C 155,188 152,165 150,145 Z" fill="#047857" opacity="0.85"/>
        <!-- Split Click Buttons -->
        <path d="M 172,85 C 185,82 196,82 198,130 L 170,130 Z" fill="#0f3d2e" stroke="#10b981" stroke-width="1"/>
        <path d="M 202,82 C 215,82 232,95 235,130 L 202,130 Z" fill="#0f3d2e" stroke="#10b981" stroke-width="1"/>
        <!-- Metallic Textured Scroll Wheel -->
        <rect x="194" y="95" width="12" height="26" rx="4" fill="#022c22" stroke="${c2}" stroke-width="1.8"/>
        <line x1="194" y1="102" x2="206" y2="102" stroke="${c1}" stroke-width="1.5"/>
        <line x1="194" y1="108" x2="206" y2="108" stroke="${c1}" stroke-width="1.5"/>
        <line x1="194" y1="114" x2="206" y2="114" stroke="${c1}" stroke-width="1.5"/>
        <!-- RGB Sensor Accent Line -->
        <path d="M 165,155 C 190,175 220,170 238,150" fill="none" stroke="${c1}" stroke-width="2.5" stroke-linecap="round"/>
        <!-- DPI Status LED -->
        <circle cx="200" cy="138" r="3" fill="${c2}"/>
      </g>
    `,
  },
  {
    id: 'ms-002',
    name: 'Ingress Vertical Mouse',
    category: 'Mice',
    tag: '57° ERGO ANGLE · ZERO WRIST STRAIN',
    accent: '#14b8a6',
    secondary: '#2dd4bf',
    bgStart: '#134e4a',
    bgEnd: '#0f172a',
    badge: 'ERGONOMIC',
    render: (c1, c2) => `
      <ellipse cx="205" cy="155" rx="75" ry="80" fill="${c1}" opacity="0.2" filter="blur(22px)"/>
      <g filter="drop-shadow(0 14px 20px rgba(20, 184, 166, 0.25))">
        <!-- Vertical 57-degree Handshake Shell -->
        <path d="M 165,220 C 145,210 145,160 160,120 C 172,85 205,75 225,90 C 245,105 255,145 250,185 C 245,215 210,225 165,220 Z" fill="#042f2e" stroke="#0d9488" stroke-width="2"/>
        <!-- Palm Rest Wave -->
        <path d="M 160,130 C 180,120 220,130 235,160 C 245,185 235,210 205,215" fill="none" stroke="${c1}" stroke-width="2"/>
        <!-- Vertical Sculpted Trigger Plate -->
        <path d="M 215,88 C 235,100 248,125 245,155 L 225,145 Z" fill="#0f766e" opacity="0.8"/>
        <!-- Vertical Scroll Wheel -->
        <rect x="228" y="110" width="8" height="22" rx="3" fill="#115e59" stroke="${c2}" stroke-width="1.5"/>
        <!-- Dual Forward/Back Thumb Buttons -->
        <rect x="155" y="145" width="6" height="14" rx="2" fill="${c1}"/>
        <rect x="154" y="163" width="6" height="14" rx="2" fill="${c1}"/>
      </g>
    `,
  },
  {
    id: 'ms-003',
    name: 'Sidecar Compact Mouse',
    category: 'Mice',
    tag: '52G ULTRA-LIGHT · PTFE GLIDES',
    accent: '#059669',
    secondary: '#10b981',
    bgStart: '#064e3b',
    bgEnd: '#022c22',
    badge: '52 GRAMS',
    render: (c1, c2) => `
      <ellipse cx="200" cy="155" rx="70" ry="70" fill="${c1}" opacity="0.18" filter="blur(20px)"/>
      <g filter="drop-shadow(0 12px 18px rgba(5, 150, 105, 0.25))">
        <!-- Symmetrical Ambidextrous Shell -->
        <path d="M 175,85 C 190,80 210,80 225,85 C 242,105 248,145 242,185 C 236,215 218,225 200,225 C 182,225 164,215 158,185 C 152,145 158,105 175,85 Z" fill="#022c22" stroke="#047857" stroke-width="2"/>
        <!-- Honeycomb Hex Cutouts for Weight Reduction -->
        ${[
          [190, 160],
          [200, 155],
          [210, 160],
          [185, 172],
          [195, 167],
          [205, 167],
          [215, 172],
          [190, 184],
          [200, 179],
          [210, 184],
          [195, 196],
          [205, 196],
        ]
          .map(
            ([hx, hy]) => `
          <polygon points="${hx},${hy - 4} ${hx + 4},${hy - 2} ${hx + 4},${hy + 2} ${hx},${hy + 4} ${hx - 4},${hy + 2} ${hx - 4},${hy - 2}" fill="${c2}" opacity="0.4"/>
        `
          )
          .join('')}
        <!-- Click Separation -->
        <line x1="200" y1="83" x2="200" y2="125" stroke="#047857" stroke-width="1.5"/>
        <rect x="195" y="92" width="10" height="20" rx="3" fill="#064e3b" stroke="${c1}" stroke-width="1.5"/>
      </g>
    `,
  },
  {
    id: 'au-001',
    name: 'Tracer Studio Headphones',
    category: 'Audio',
    tag: '50MM PLANAR DRIVER · HIGH-RES',
    accent: '#8b5cf6',
    secondary: '#a78bfa',
    bgStart: '#2e1065',
    bgEnd: '#0f172a',
    badge: 'STUDIO PRO',
    render: (c1, c2) => `
      <ellipse cx="200" cy="155" rx="100" ry="80" fill="${c1}" opacity="0.22" filter="blur(26px)"/>
      <g filter="drop-shadow(0 14px 22px rgba(139, 92, 246, 0.3))">
        <!-- Spring Steel Headband -->
        <path d="M 125,160 C 120,85 280,85 275,160" fill="none" stroke="#4c1d95" stroke-width="8" stroke-linecap="round"/>
        <path d="M 135,150 C 135,95 265,95 265,150" fill="none" stroke="${c1}" stroke-width="3" stroke-linecap="round"/>
        <!-- Padded Headband Cushion -->
        <path d="M 155,108 C 175,98 225,98 245,108" fill="none" stroke="#1e1b4b" stroke-width="12" stroke-linecap="round"/>
        <!-- Metal Sliders & Pivot Yokes -->
        <rect x="117" y="145" width="14" height="22" rx="4" fill="#6d28d9" stroke="${c2}" stroke-width="1"/>
        <rect x="269" y="145" width="14" height="22" rx="4" fill="#6d28d9" stroke="${c2}" stroke-width="1"/>
        <!-- Left Plush Ear Cup -->
        <rect x="110" y="155" width="28" height="60" rx="14" fill="#1e1b4b" stroke="${c1}" stroke-width="2"/>
        <rect x="122" y="160" width="12" height="50" rx="6" fill="#0f172a"/>
        <!-- Right Plush Ear Cup -->
        <rect x="262" y="155" width="28" height="60" rx="14" fill="#1e1b4b" stroke="${c1}" stroke-width="2"/>
        <rect x="266" y="160" width="12" height="50" rx="6" fill="#0f172a"/>
        <!-- Planar Acoustic Mesh Center Accent -->
        <circle cx="124" cy="185" r="5" fill="${c2}"/>
        <circle cx="276" cy="185" r="5" fill="${c2}"/>
      </g>
    `,
  },
  {
    id: 'au-002',
    name: 'Span Noise-Cancelling Earbuds',
    category: 'Audio',
    tag: '-42DB HYBRID ANC · 36H BATTERY',
    accent: '#a855f7',
    secondary: '#c084fc',
    bgStart: '#3b0764',
    bgEnd: '#0f172a',
    badge: 'HYBRID ANC',
    render: (c1, c2) => `
      <ellipse cx="200" cy="155" rx="85" ry="60" fill="${c1}" opacity="0.2" filter="blur(22px)"/>
      <g filter="drop-shadow(0 14px 20px rgba(168, 85, 247, 0.25))">
        <!-- Open Charging Case Base -->
        <path d="M 140,140 C 140,120 260,120 260,140 C 260,185 240,205 200,205 C 160,205 140,185 140,140 Z" fill="#1e1035" stroke="#7e22ce" stroke-width="2"/>
        <!-- Charging Bays -->
        <ellipse cx="175" cy="148" rx="18" ry="22" fill="#0f0720" stroke="${c1}" stroke-width="1.2"/>
        <ellipse cx="225" cy="148" rx="18" ry="22" fill="#0f0720" stroke="${c1}" stroke-width="1.2"/>
        <!-- Left Earbud Head -->
        <circle cx="175" cy="142" r="12" fill="#3b0764" stroke="${c2}" stroke-width="1.8"/>
        <circle cx="175" cy="142" r="6" fill="${c1}"/>
        <!-- Right Earbud Head -->
        <circle cx="225" cy="142" r="12" fill="#3b0764" stroke="${c2}" stroke-width="1.8"/>
        <circle cx="225" cy="142" r="6" fill="${c1}"/>
        <!-- Status Battery LED Dots -->
        <circle cx="195" cy="188" r="2" fill="${c2}"/>
        <circle cx="200" cy="188" r="2" fill="${c2}"/>
        <circle cx="205" cy="188" r="2" fill="${c2}"/>
      </g>
    `,
  },
  {
    id: 'au-003',
    name: 'Mesh USB Microphone',
    category: 'Audio',
    tag: '192KHZ/24-BIT · CARDIOID CONDENSER',
    accent: '#7c3aed',
    secondary: '#a78bfa',
    bgStart: '#2e1065',
    bgEnd: '#090514',
    badge: 'BROADCAST',
    render: (c1, c2) => `
      <ellipse cx="200" cy="155" rx="75" ry="75" fill="${c1}" opacity="0.22" filter="blur(24px)"/>
      <g filter="drop-shadow(0 14px 22px rgba(124, 58, 237, 0.28))">
        <!-- Cast Metal Desk Base -->
        <ellipse cx="200" cy="220" rx="50" ry="12" fill="#1e1b4b" stroke="#4c1d95" stroke-width="2"/>
        <rect x="196" y="180" width="8" height="40" fill="#2e1065" stroke="${c1}" stroke-width="1"/>
        <!-- U-Shaped Shockmount Arms -->
        <path d="M 165,140 C 165,190 235,190 235,140" fill="none" stroke="${c1}" stroke-width="3" stroke-linecap="round"/>
        <!-- Microphone Capsule Cylinder -->
        <rect x="175" y="80" width="50" height="90" rx="25" fill="#0f0728" stroke="#5b21b6" stroke-width="2"/>
        <!-- Upper Mesh Grille -->
        <path d="M 175,105 C 175,80 225,80 225,105 Z" fill="#2e1065" stroke="${c2}" stroke-width="1"/>
        ${[85, 92, 99].map((y) => `<line x1="182" y1="${y}" x2="218" y2="${y}" stroke="${c2}" stroke-width="1" opacity="0.6"/>`).join('')}
        <!-- Glowing Gain Ring -->
        <circle cx="200" cy="135" r="8" fill="none" stroke="${c1}" stroke-width="2.5"/>
        <circle cx="200" cy="135" r="3" fill="${c2}"/>
        <!-- Mute Touch Sensor LED -->
        <line x1="192" y1="158" x2="208" y2="158" stroke="#10b981" stroke-width="2" stroke-linecap="round"/>
      </g>
    `,
  },
  {
    id: 'ac-001',
    name: 'Rollout Desk Mat XL',
    category: 'Accessories',
    tag: '900X400MM · CONTOUR TOPOGRAPHY',
    accent: '#f59e0b',
    secondary: '#fbbf24',
    bgStart: '#451a03',
    bgEnd: '#0f172a',
    badge: 'BESTSELLER',
    render: (c1, c2) => `
      <ellipse cx="200" cy="155" rx="140" ry="60" fill="${c1}" opacity="0.2" filter="blur(25px)"/>
      <g filter="drop-shadow(0 14px 20px rgba(245, 158, 11, 0.25))">
        <!-- Stitched Mat Surface -->
        <rect x="65" y="90" width="270" height="120" rx="14" fill="#18120c" stroke="${c1}" stroke-width="2.5"/>
        <rect x="70" y="95" width="260" height="110" rx="10" fill="#24170d"/>
        <!-- Topographic Elevation Lines -->
        <path d="M 80,180 C 130,120 180,210 240,130 C 270,90 310,130 320,110" fill="none" stroke="${c1}" stroke-width="1.5" opacity="0.8"/>
        <path d="M 80,160 C 125,105 175,190 230,118 C 265,80 300,115 320,95" fill="none" stroke="${c2}" stroke-width="1.2" opacity="0.6"/>
        <path d="M 90,200 C 140,140 190,215 250,145 C 280,110 310,145 320,130" fill="none" stroke="${c1}" stroke-width="1.2" opacity="0.5"/>
        <path d="M 120,135 C 145,110 170,140 190,125" fill="none" stroke="${c2}" stroke-width="1" opacity="0.7"/>
        <circle cx="155" cy="125" r="12" fill="none" stroke="${c1}" stroke-width="1" opacity="0.5"/>
        <!-- Woven Corner Brand Tag -->
        <rect x="285" y="185" width="30" height="12" rx="2" fill="${c1}"/>
        <text x="300" y="193" font-family="monospace" font-size="6" font-weight="bold" fill="#000000" text-anchor="middle">KUBE</text>
      </g>
    `,
  },
  {
    id: 'ac-002',
    name: 'Cluster USB-C Hub',
    category: 'Accessories',
    tag: '10-IN-1 · 100W PD · DUAL 4K60HZ',
    accent: '#d97706',
    secondary: '#f59e0b',
    bgStart: '#3b1d07',
    bgEnd: '#0f172a',
    badge: '10-IN-1',
    render: (c1, c2) => `
      <ellipse cx="200" cy="155" rx="120" ry="60" fill="${c1}" opacity="0.2" filter="blur(22px)"/>
      <g filter="drop-shadow(0 14px 20px rgba(217, 119, 6, 0.25))">
        <!-- Anodized Space Gray Chassis -->
        <rect x="90" y="110" width="220" height="80" rx="10" fill="#1c1611" stroke="#78350f" stroke-width="2"/>
        <rect x="94" y="114" width="212" height="72" rx="7" fill="#291e14"/>
        <!-- Braided Host Cable Accent -->
        <path d="M 90,150 C 65,150 55,165 40,165" fill="none" stroke="#d97706" stroke-width="5" stroke-linecap="round"/>
        <!-- Ports Front Row -->
        <!-- USB-C 10Gbps Ports -->
        <rect x="110" y="140" width="16" height="6" rx="2" fill="#0b0806" stroke="${c2}" stroke-width="1"/>
        <rect x="135" y="140" width="16" height="6" rx="2" fill="#0b0806" stroke="${c2}" stroke-width="1"/>
        <!-- USB-A 3.2 Ports -->
        <rect x="160" y="138" width="18" height="9" rx="2" fill="#0284c7" stroke="#38bdf8" stroke-width="1"/>
        <rect x="185" y="138" width="18" height="9" rx="2" fill="#0284c7" stroke="#38bdf8" stroke-width="1"/>
        <!-- SD / TF Card Slots -->
        <rect x="212" y="140" width="22" height="4" rx="1" fill="#0b0806" stroke="#92400e" stroke-width="0.8"/>
        <rect x="240" y="140" width="14" height="3" rx="1" fill="#0b0806" stroke="#92400e" stroke-width="0.8"/>
        <!-- HDMI Indicator -->
        <rect x="265" y="136" width="24" height="12" rx="2" fill="#0b0806" stroke="${c1}" stroke-width="1"/>
        <!-- Power LED Status Light -->
        <circle cx="295" cy="125" r="2.5" fill="#10b981"/>
      </g>
    `,
  },
  {
    id: 'ac-003',
    name: 'Namespace Monitor Light Bar',
    category: 'Accessories',
    tag: 'AUTO-DIMMING · ZERO SCREEN GLARE',
    accent: '#eab308',
    secondary: '#fef08a',
    bgStart: '#422006',
    bgEnd: '#0f172a',
    badge: 'EYE CARE',
    render: (c1, c2) => `
      <!-- Ambient Glow Fan Beam -->
      <polygon points="200,95 70,225 330,225" fill="url(#lightbar-beam)" opacity="0.45"/>
      <ellipse cx="200" cy="225" rx="130" ry="20" fill="${c1}" opacity="0.25" filter="blur(16px)"/>
      <g filter="drop-shadow(0 12px 18px rgba(234, 179, 8, 0.3))">
        <!-- Counterweight Clamp Mount -->
        <rect x="185" y="70" width="30" height="25" rx="4" fill="#1c1917" stroke="#78350f" stroke-width="1.5"/>
        <circle cx="200" cy="82" r="6" fill="#292524" stroke="${c1}" stroke-width="1"/>
        <!-- Main Aluminum Light Bar Tube -->
        <rect x="60" y="90" width="280" height="14" rx="7" fill="#181308" stroke="#ca8a04" stroke-width="2"/>
        <!-- Illuminated Warm Asymmetric LED Strip -->
        <rect x="70" y="98" width="260" height="4" rx="2" fill="${c2}"/>
        <!-- Capacitive Touch Controls on Top -->
        <circle cx="160" cy="94" r="2" fill="${c2}"/>
        <circle cx="200" cy="94" r="2.5" fill="#ffffff"/>
        <circle cx="240" cy="94" r="2" fill="${c2}"/>
      </g>
    `,
  },
];

for (const p of products) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300">
  <defs>
    <!-- Background Gradient -->
    <linearGradient id="bg-${p.id}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${p.bgStart}" />
      <stop offset="100%" stop-color="${p.bgEnd}" />
    </linearGradient>

    <!-- Knob Gradient -->
    <radialGradient id="knob-grad" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${p.secondary}" />
      <stop offset="60%" stop-color="${p.accent}" />
      <stop offset="100%" stop-color="#0f172a" />
    </radialGradient>

    <!-- Spacebar Accent Gradients -->
    <linearGradient id="spacebar-grad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${p.accent}" />
      <stop offset="50%" stop-color="${p.secondary}" />
      <stop offset="100%" stop-color="${p.accent}" />
    </linearGradient>

    <linearGradient id="spacebar-cyan" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#0284c7" />
      <stop offset="50%" stop-color="#38bdf8" />
      <stop offset="100%" stop-color="#0284c7" />
    </linearGradient>

    <!-- Light Bar Beam Gradient -->
    <linearGradient id="lightbar-beam" x1="50%" y1="0%" x2="50%" y2="100%">
      <stop offset="0%" stop-color="${p.secondary}" stop-opacity="0.8" />
      <stop offset="40%" stop-color="${p.accent}" stop-opacity="0.3" />
      <stop offset="100%" stop-color="${p.accent}" stop-opacity="0" />
    </linearGradient>
  </defs>

  <!-- Deep Slate Outer Chassis Canvas -->
  <rect width="400" height="300" rx="14" fill="url(#bg-${p.id})" />
  <rect x="1.5" y="1.5" width="397" height="297" rx="12.5" fill="none" stroke="#334155" stroke-width="1.2" opacity="0.6"/>

  <!-- Subtle Blueprint Tech Grid Pattern -->
  <g opacity="0.08" stroke="#ffffff" stroke-width="0.8">
    <line x1="40" y1="0" x2="40" y2="300"/>
    <line x1="80" y1="0" x2="80" y2="300"/>
    <line x1="120" y1="0" x2="120" y2="300"/>
    <line x1="160" y1="0" x2="160" y2="300"/>
    <line x1="200" y1="0" x2="200" y2="300"/>
    <line x1="240" y1="0" x2="240" y2="300"/>
    <line x1="280" y1="0" x2="280" y2="300"/>
    <line x1="320" y1="0" x2="320" y2="300"/>
    <line x1="360" y1="0" x2="360" y2="300"/>
    <line x1="0" y1="60" x2="400" y2="60"/>
    <line x1="0" y1="120" x2="400" y2="120"/>
    <line x1="0" y1="180" x2="400" y2="180"/>
    <line x1="0" y1="240" x2="400" y2="240"/>
  </g>

  <!-- Top Status Bar: Category & Spec Tag -->
  <rect x="20" y="18" width="${p.badge.length * 8 + 16}" height="20" rx="4" fill="${p.accent}" fill-opacity="0.2" stroke="${p.accent}" stroke-width="1"/>
  <text x="${28 + (p.badge.length * 8 + 16) / 2 - 8}" y="32" font-family="system-ui, -apple-system, sans-serif" font-size="9" font-weight="800" fill="${p.secondary}" text-anchor="middle" letter-spacing="0.5">${p.badge}</text>

  <text x="380" y="32" font-family="monospace" font-size="10" font-weight="600" fill="#94a3b8" text-anchor="end" letter-spacing="0.5">${p.tag}</text>

  <!-- Main Product Render Art -->
  ${p.render(p.accent, p.secondary)}

  <!-- Bottom Info Glow Bar -->
  <rect x="20" y="248" width="360" height="38" rx="8" fill="#0b0f19" fill-opacity="0.8" stroke="#1e293b" stroke-width="1"/>
  <circle cx="36" cy="267" r="4" fill="${p.accent}"/>
  <text x="48" y="271" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="700" fill="#f8fafc">${p.name}</text>
  <text x="368" y="271" font-family="monospace" font-size="11" font-weight="700" fill="${p.secondary}" text-anchor="end">${p.id.toUpperCase()}</text>
</svg>
`;

  fs.writeFileSync(path.join(outDir, `${p.id}.svg`), svg, 'utf8');
}

// Generate high-end placeholder.svg
const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300">
  <defs>
    <linearGradient id="ph-bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#1e293b" />
    </linearGradient>
  </defs>
  <rect width="400" height="300" rx="14" fill="url(#ph-bg)" />
  <rect x="1.5" y="1.5" width="397" height="297" rx="12.5" fill="none" stroke="#334155" stroke-width="1.2" opacity="0.6"/>
  <circle cx="200" cy="135" r="38" fill="none" stroke="#475569" stroke-width="2.5" stroke-dasharray="6 4" />
  <path d="M 180,135 L 220,135 M 200,115 L 200,155" stroke="#64748b" stroke-width="2.5" stroke-linecap="round" />
  <text x="200" y="205" font-family="system-ui, sans-serif" font-size="13" font-weight="600" fill="#94a3b8" text-anchor="middle">HARDWARE SCHEMATIC</text>
  <text x="200" y="225" font-family="monospace" font-size="10" fill="#64748b" text-anchor="middle">KUBESHOP VERIFIED</text>
</svg>
`;
fs.writeFileSync(
  path.resolve(__dirname, '../public/images/placeholder.svg'),
  placeholderSvg,
  'utf8'
);

// Generate high-end favicon.svg
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <defs>
    <linearGradient id="fav-bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2563eb" />
      <stop offset="100%" stop-color="#1d4ed8" />
    </linearGradient>
  </defs>
  <rect width="32" height="32" rx="8" fill="url(#fav-bg)" />
  <path d="M16 6 L26 12 L26 24 L16 29 L6 24 L6 12 Z" fill="none" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"/>
  <circle cx="16" cy="17" r="4.5" fill="#60a5fa" stroke="#ffffff" stroke-width="1.5"/>
</svg>
`;
fs.writeFileSync(path.resolve(__dirname, '../public/favicon.svg'), faviconSvg, 'utf8');

console.log(
  'Successfully generated 12 high-fidelity product SVGs, placeholder.svg, and favicon.svg.'
);
