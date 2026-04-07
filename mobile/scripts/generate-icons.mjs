import sharp from 'sharp'
import { readFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const assetsDir = join(__dirname, '..', 'assets')

// ── Logo Mark SVG (no background — for compositing) ──────────────────────
const markSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <line x1="136" y1="136" x2="376" y2="136" stroke="#1D7A5F" stroke-width="6" stroke-linecap="round" opacity="0.5"/>
  <line x1="136" y1="256" x2="376" y2="256" stroke="#1D7A5F" stroke-width="6" stroke-linecap="round" opacity="0.5"/>
  <line x1="136" y1="376" x2="376" y2="376" stroke="#1D7A5F" stroke-width="6" stroke-linecap="round" opacity="0.5"/>
  <line x1="136" y1="136" x2="136" y2="376" stroke="#1D7A5F" stroke-width="6" stroke-linecap="round" opacity="0.5"/>
  <line x1="256" y1="136" x2="256" y2="376" stroke="#1D7A5F" stroke-width="6" stroke-linecap="round" opacity="0.5"/>
  <line x1="376" y1="136" x2="376" y2="376" stroke="#1D7A5F" stroke-width="6" stroke-linecap="round" opacity="0.5"/>
  <circle cx="136" cy="136" r="22" fill="#2AAA7F"/>
  <circle cx="256" cy="136" r="22" fill="#2AAA7F"/>
  <circle cx="376" cy="136" r="22" fill="#2AAA7F"/>
  <circle cx="136" cy="256" r="22" fill="#2AAA7F"/>
  <circle cx="376" cy="256" r="22" fill="#2AAA7F"/>
  <circle cx="136" cy="376" r="22" fill="#2AAA7F"/>
  <circle cx="256" cy="376" r="22" fill="#2AAA7F"/>
  <circle cx="376" cy="376" r="22" fill="#2AAA7F"/>
  <circle cx="256" cy="256" r="34" fill="#1D7A5F"/>
  <circle cx="256" cy="256" r="18" fill="#2AAA7F" opacity="0.3"/>
</svg>`

// ── App Icon (mark centered on cream background, filling ~70%) ───────────
const iconSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <rect width="1024" height="1024" fill="#FAFAF7"/>
  <g transform="translate(132, 132) scale(1.484)">
    <line x1="136" y1="136" x2="376" y2="136" stroke="#1D7A5F" stroke-width="6" stroke-linecap="round" opacity="0.5"/>
    <line x1="136" y1="256" x2="376" y2="256" stroke="#1D7A5F" stroke-width="6" stroke-linecap="round" opacity="0.5"/>
    <line x1="136" y1="376" x2="376" y2="376" stroke="#1D7A5F" stroke-width="6" stroke-linecap="round" opacity="0.5"/>
    <line x1="136" y1="136" x2="136" y2="376" stroke="#1D7A5F" stroke-width="6" stroke-linecap="round" opacity="0.5"/>
    <line x1="256" y1="136" x2="256" y2="376" stroke="#1D7A5F" stroke-width="6" stroke-linecap="round" opacity="0.5"/>
    <line x1="376" y1="136" x2="376" y2="376" stroke="#1D7A5F" stroke-width="6" stroke-linecap="round" opacity="0.5"/>
    <circle cx="136" cy="136" r="22" fill="#2AAA7F"/>
    <circle cx="256" cy="136" r="22" fill="#2AAA7F"/>
    <circle cx="376" cy="136" r="22" fill="#2AAA7F"/>
    <circle cx="136" cy="256" r="22" fill="#2AAA7F"/>
    <circle cx="376" cy="256" r="22" fill="#2AAA7F"/>
    <circle cx="136" cy="376" r="22" fill="#2AAA7F"/>
    <circle cx="256" cy="376" r="22" fill="#2AAA7F"/>
    <circle cx="376" cy="376" r="22" fill="#2AAA7F"/>
    <circle cx="256" cy="256" r="34" fill="#1D7A5F"/>
    <circle cx="256" cy="256" r="18" fill="#2AAA7F" opacity="0.3"/>
  </g>
</svg>`

// ── Splash Icon (mark on cream, smaller for splash screen) ───────────────
const splashSVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" fill="#FAFAF7"/>
  <g transform="translate(56, 56) scale(0.78)">
    <line x1="136" y1="136" x2="376" y2="136" stroke="#1D7A5F" stroke-width="6" stroke-linecap="round" opacity="0.5"/>
    <line x1="136" y1="256" x2="376" y2="256" stroke="#1D7A5F" stroke-width="6" stroke-linecap="round" opacity="0.5"/>
    <line x1="136" y1="376" x2="376" y2="376" stroke="#1D7A5F" stroke-width="6" stroke-linecap="round" opacity="0.5"/>
    <line x1="136" y1="136" x2="136" y2="376" stroke="#1D7A5F" stroke-width="6" stroke-linecap="round" opacity="0.5"/>
    <line x1="256" y1="136" x2="256" y2="376" stroke="#1D7A5F" stroke-width="6" stroke-linecap="round" opacity="0.5"/>
    <line x1="376" y1="136" x2="376" y2="376" stroke="#1D7A5F" stroke-width="6" stroke-linecap="round" opacity="0.5"/>
    <circle cx="136" cy="136" r="22" fill="#2AAA7F"/>
    <circle cx="256" cy="136" r="22" fill="#2AAA7F"/>
    <circle cx="376" cy="136" r="22" fill="#2AAA7F"/>
    <circle cx="136" cy="256" r="22" fill="#2AAA7F"/>
    <circle cx="376" cy="256" r="22" fill="#2AAA7F"/>
    <circle cx="136" cy="376" r="22" fill="#2AAA7F"/>
    <circle cx="256" cy="376" r="22" fill="#2AAA7F"/>
    <circle cx="376" cy="376" r="22" fill="#2AAA7F"/>
    <circle cx="256" cy="256" r="34" fill="#1D7A5F"/>
    <circle cx="256" cy="256" r="18" fill="#2AAA7F" opacity="0.3"/>
  </g>
</svg>`

async function generate() {
  console.log('Generating MicroGRID app icons...')

  // App icon — 1024x1024
  await sharp(Buffer.from(iconSVG))
    .resize(1024, 1024)
    .png()
    .toFile(join(assetsDir, 'icon.png'))
  console.log('  ✓ icon.png (1024x1024)')

  // Adaptive icon — same as icon for Android
  await sharp(Buffer.from(iconSVG))
    .resize(1024, 1024)
    .png()
    .toFile(join(assetsDir, 'adaptive-icon.png'))
  console.log('  ✓ adaptive-icon.png (1024x1024)')

  // Splash icon — 512x512
  await sharp(Buffer.from(splashSVG))
    .resize(512, 512)
    .png()
    .toFile(join(assetsDir, 'splash-icon.png'))
  console.log('  ✓ splash-icon.png (512x512)')

  // Favicon — 48x48
  await sharp(Buffer.from(iconSVG))
    .resize(48, 48)
    .png()
    .toFile(join(assetsDir, 'favicon.png'))
  console.log('  ✓ favicon.png (48x48)')

  console.log('\nDone. All icons generated in mobile/assets/')
}

generate().catch(console.error)
