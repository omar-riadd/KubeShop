import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const products = [
  {
    id: 'kb-001',
    name: 'Nimbus 75 Mechanical Keyboard',
    category: 'keyboards',
    color: '#3b82f6',
    icon: 'keyboard',
  },
  {
    id: 'kb-002',
    name: 'Helm 60 Wireless Keyboard',
    category: 'keyboards',
    color: '#2563eb',
    icon: 'keyboard',
  },
  {
    id: 'kb-003',
    name: 'Pod TKL Low-Profile Keyboard',
    category: 'keyboards',
    color: '#1d4ed8',
    icon: 'keyboard',
  },
  {
    id: 'ms-001',
    name: 'Orbit Ergonomic Mouse',
    category: 'mice',
    color: '#10b981',
    icon: 'mouse',
  },
  {
    id: 'ms-002',
    name: 'Ingress Vertical Mouse',
    category: 'mice',
    color: '#059669',
    icon: 'mouse',
  },
  {
    id: 'ms-003',
    name: 'Sidecar Compact Mouse',
    category: 'mice',
    color: '#047857',
    icon: 'mouse',
  },
  {
    id: 'au-001',
    name: 'Tracer Studio Headphones',
    category: 'audio',
    color: '#8b5cf6',
    icon: 'headphones',
  },
  {
    id: 'au-002',
    name: 'Span Noise-Cancelling Earbuds',
    category: 'audio',
    color: '#7c3aed',
    icon: 'headphones',
  },
  { id: 'au-003', name: 'Mesh USB Microphone', category: 'audio', color: '#6d28d9', icon: 'mic' },
  {
    id: 'ac-001',
    name: 'Rollout Desk Mat XL',
    category: 'accessories',
    color: '#f59e0b',
    icon: 'grid',
  },
  {
    id: 'ac-002',
    name: 'Cluster USB-C Hub',
    category: 'accessories',
    color: '#d97706',
    icon: 'cpu',
  },
  {
    id: 'ac-003',
    name: 'Namespace Monitor Light Bar',
    category: 'accessories',
    color: '#b45309',
    icon: 'sun',
  },
];

const outDir = path.resolve(__dirname, '../public/images/products');
fs.mkdirSync(outDir, { recursive: true });

function renderGlyph(icon, color) {
  switch (icon) {
    case 'keyboard':
      return `
        <rect x="130" y="110" width="140" height="80" rx="8" fill="none" stroke="${color}" stroke-width="4"/>
        <line x1="145" y1="130" x2="165" y2="130" stroke="${color}" stroke-width="4" stroke-linecap="round"/>
        <line x1="175" y1="130" x2="195" y2="130" stroke="${color}" stroke-width="4" stroke-linecap="round"/>
        <line x1="205" y1="130" x2="225" y2="130" stroke="${color}" stroke-width="4" stroke-linecap="round"/>
        <line x1="235" y1="130" x2="255" y2="130" stroke="${color}" stroke-width="4" stroke-linecap="round"/>
        <line x1="155" y1="150" x2="185" y2="150" stroke="${color}" stroke-width="4" stroke-linecap="round"/>
        <line x1="195" y1="150" x2="245" y2="150" stroke="${color}" stroke-width="4" stroke-linecap="round"/>
      `;
    case 'mouse':
      return `
        <rect x="160" y="100" width="80" height="110" rx="40" fill="none" stroke="${color}" stroke-width="4"/>
        <line x1="200" y1="100" x2="200" y2="140" stroke="${color}" stroke-width="4"/>
        <circle cx="200" cy="125" r="4" fill="${color}"/>
      `;
    case 'headphones':
      return `
        <path d="M140,160 A60,60 0 0,1 260,160" fill="none" stroke="${color}" stroke-width="6"/>
        <rect x="130" y="150" width="20" height="40" rx="6" fill="${color}"/>
        <rect x="250" y="150" width="20" height="40" rx="6" fill="${color}"/>
      `;
    case 'mic':
      return `
        <rect x="180" y="100" width="40" height="70" rx="20" fill="none" stroke="${color}" stroke-width="4"/>
        <path d="M165,140 A35,35 0 0,0 235,140" fill="none" stroke="${color}" stroke-width="4"/>
        <line x1="200" y1="175" x2="200" y2="200" stroke="${color}" stroke-width="4"/>
        <line x1="180" y1="200" x2="220" y2="200" stroke="${color}" stroke-width="4" stroke-linecap="round"/>
      `;
    case 'cpu':
      return `
        <rect x="150" y="100" width="100" height="100" rx="10" fill="none" stroke="${color}" stroke-width="4"/>
        <rect x="175" y="125" width="50" height="50" rx="4" fill="${color}" opacity="0.3"/>
        <line x1="170" y1="90" x2="170" y2="100" stroke="${color}" stroke-width="3"/>
        <line x1="200" y1="90" x2="200" y2="100" stroke="${color}" stroke-width="3"/>
        <line x1="230" y1="90" x2="230" y2="100" stroke="${color}" stroke-width="3"/>
        <line x1="170" y1="200" x2="170" y2="210" stroke="${color}" stroke-width="3"/>
        <line x1="200" y1="200" x2="200" y2="210" stroke="${color}" stroke-width="3"/>
        <line x1="230" y1="200" x2="230" y2="210" stroke="${color}" stroke-width="3"/>
      `;
    case 'sun':
      return `
        <rect x="120" y="145" width="160" height="10" rx="5" fill="${color}"/>
        <path d="M140,165 L130,195 M200,165 L200,200 M260,165 L270,195" stroke="${color}" stroke-width="3" stroke-linecap="round"/>
      `;
    default:
      return `
        <rect x="130" y="110" width="140" height="80" rx="8" fill="none" stroke="${color}" stroke-width="4"/>
        <circle cx="200" cy="150" r="20" fill="none" stroke="${color}" stroke-width="4"/>
      `;
  }
}

for (const p of products) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300">
  <defs>
    <linearGradient id="bg-${p.id}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#1e293b" />
    </linearGradient>
  </defs>
  <rect width="400" height="300" rx="12" fill="url(#bg-${p.id})" />
  <rect x="1" y="1" width="398" height="298" rx="11" fill="none" stroke="#334155" stroke-width="1" />
  ${renderGlyph(p.icon, p.color)}
  <text x="200" y="240" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="600" fill="#94a3b8" text-anchor="middle">${p.name}</text>
  <text x="200" y="265" font-family="monospace" font-size="12" fill="${p.color}" text-anchor="middle">${p.id.toUpperCase()}</text>
</svg>
`;

  fs.writeFileSync(path.join(outDir, `${p.id}.svg`), svg, 'utf8');
}

// Generate placeholder.svg
const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300">
  <rect width="400" height="300" rx="12" fill="#1e293b" />
  <rect x="1" y="1" width="398" height="298" rx="11" fill="none" stroke="#334155" stroke-width="1" />
  <circle cx="200" cy="140" r="30" fill="none" stroke="#64748b" stroke-width="3" />
  <path d="M150,190 L250,190" stroke="#64748b" stroke-width="3" stroke-linecap="round" />
  <text x="200" y="240" font-family="system-ui, sans-serif" font-size="14" fill="#94a3b8" text-anchor="middle">Image Unavailable</text>
</svg>
`;
fs.writeFileSync(
  path.resolve(__dirname, '../public/images/placeholder.svg'),
  placeholderSvg,
  'utf8'
);

// Generate favicon.svg
const faviconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="8" fill="#326CE5" />
  <path d="M16 6 L26 12 L26 24 L16 29 L6 24 L6 12 Z" fill="none" stroke="#ffffff" stroke-width="2" />
  <circle cx="16" cy="17" r="4" fill="#ffffff" />
</svg>
`;
fs.writeFileSync(path.resolve(__dirname, '../public/favicon.svg'), faviconSvg, 'utf8');

console.log('Successfully generated 12 product SVGs, placeholder.svg, and favicon.svg.');
