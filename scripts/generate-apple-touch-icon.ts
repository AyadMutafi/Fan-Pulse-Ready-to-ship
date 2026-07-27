/**
 * Generate /public/apple-touch-icon.png (180×180) from /public/icon.svg.
 *
 * Apple Touch Icons must be PNG (iOS doesn't support SVG for home-screen
 * icons). We render the Fan Pulse bolt SVG at 180×180 with sharp.
 *
 * Run: bunx tsx scripts/generate-apple-touch-icon.ts
 */
import sharp from 'sharp'
import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'

async function main() {
  const svgPath = resolve(process.cwd(), 'public/icon.svg')
  const pngPath = resolve(process.cwd(), 'public/apple-touch-icon.png')

  const svgBuffer = readFileSync(svgPath)

  // Render at 180×180 (Apple's recommended apple-touch-icon size).
  // No padding — the SVG already has the rounded-square background filling
  // the viewBox, so iOS will crop to its own squircle automatically.
  const pngBuffer = await sharp(svgBuffer, { density: 384 })
    .resize(180, 180, { fit: 'cover', position: 'center' })
    .png()
    .toBuffer()

  writeFileSync(pngPath, pngBuffer)
  console.log(`✓ Generated ${pngPath} (${pngBuffer.length} bytes, 180×180 PNG)`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
