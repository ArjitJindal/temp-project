const { PurgeCSS } = require('purgecss')
const fs = require('fs-extra')
const path = require('path')
const glob = require('glob')
const zlib = require('zlib')

async function main() {
  console.log('🧹 Running CSS optimization...')

  const cssFiles = glob
    .sync('dist/**/*.css')
    .filter((file) => !file.includes('chunks/'))

  if (!cssFiles.length) {
    console.log('No CSS files found to optimize')
    return
  }

  console.log(`Found ${cssFiles.length} CSS files to optimize`)

  let totalOriginalSize = 0
  let totalOptimizedSize = 0
  let totalOriginalGzipSize = 0
  let totalOptimizedGzipSize = 0

  for (const cssFile of cssFiles) {
    const originalCss = fs.readFileSync(cssFile, 'utf8')
    const originalSize = Buffer.byteLength(originalCss, 'utf8')
    const originalGzipSize = zlib.brotliCompressSync(
      Buffer.from(originalCss)
    ).length
    totalOriginalSize += originalSize
    totalOriginalGzipSize += originalGzipSize

    console.log(`Processing ${path.basename(cssFile)}...`)

    try {
      // Run PurgeCSS
      const result = await new PurgeCSS().purge({
        content: ['./src/**/*.{js,jsx,ts,tsx}', './dist/index.html'],
        css: [{ raw: originalCss }],
        safelist: {
          standard: [
            // Keep Ant Design classes
            /^ant-/,
            // Common dynamic classes
            /^(show|hide|active|inactive|open|closed|selected|disabled|enabled|focused|blur|expanded|collapsed)/,
            // Common utility classes
            /^(flex|grid|block|inline|table|none|visible|invisible|relative|absolute|fixed|sticky)/,
          ],
          deep: [/^ant-/],
          greedy: [/^ant-/],
          variables: [/:root/, /^--/],
        },
        fontFace: true,
        keyframes: true,
        variables: true,
      })

      if (result.length > 0 && result[0].css) {
        const purgedCss = result[0].css
        const purgedSize = Buffer.byteLength(purgedCss, 'utf8')
        const purgedGzipSize = zlib.brotliCompressSync(
          Buffer.from(purgedCss)
        ).length
        totalOptimizedSize += purgedSize
        totalOptimizedGzipSize += purgedGzipSize

        const reduction = (
          ((originalSize - purgedSize) / originalSize) *
          100
        ).toFixed(1)
        const reductionGzip = (
          ((originalGzipSize - purgedGzipSize) / originalGzipSize) *
          100
        ).toFixed(1)

        fs.writeFileSync(cssFile, purgedCss)

        console.log(
          `✅ ${path.basename(cssFile)}: ${reduction}% reduction (${(
            originalSize / 1024
          ).toFixed(1)}KB → ${(purgedSize / 1024).toFixed(1)}KB)`
        )
        console.log(
          `   Compressed: ${reductionGzip}% reduction (${(
            originalGzipSize / 1024
          ).toFixed(1)}KB → ${(purgedGzipSize / 1024).toFixed(1)}KB)`
        )
      } else {
        console.log(`⚠️ No CSS output for ${cssFile}`)
        totalOptimizedSize += originalSize
        totalOptimizedGzipSize += originalGzipSize
      }
    } catch (error) {
      console.error(`Error processing ${cssFile}:`, error)
      totalOptimizedSize += originalSize
      totalOptimizedGzipSize += originalGzipSize
    }
  }

  if (cssFiles.length > 0) {
    const totalReduction = (
      ((totalOriginalSize - totalOptimizedSize) / totalOriginalSize) *
      100
    ).toFixed(1)
    const totalReductionGzip = (
      ((totalOriginalGzipSize - totalOptimizedGzipSize) /
        totalOriginalGzipSize) *
      100
    ).toFixed(1)

    console.log('\n📊 Overall CSS Optimization Results:')
    console.log(
      `   Raw: ${totalReduction}% reduction (${(totalOriginalSize / 1024).toFixed(1)}KB → ${(
        totalOptimizedSize / 1024
      ).toFixed(1)}KB)`
    )
    console.log(
      `   Compressed: ${totalReductionGzip}% reduction (${(
        totalOriginalGzipSize / 1024
      ).toFixed(1)}KB → ${(totalOptimizedGzipSize / 1024).toFixed(1)}KB)`
    )
  }

  console.log('CSS optimization completed')
}

main().catch((err) => {
  console.error('Error optimizing CSS:', err)
  process.exit(1)
})
