#!/usr/bin/env node
const path = require('path')
const esbuild = require('esbuild')
const fs = require('fs-extra')
const enhancedResolve = require('enhanced-resolve')
const builtinModules = require('builtin-modules')

// These are transitive dependencies of our dependencies, which for some reasons
// are not specified in dependencies or specified in devDependencies and are
// not installed, but still used in code, so need to be declared as external
const IGNORED = [
  'coffee-script',
  '@google-cloud/common',
  'kerberos',
  'bson-ext',
  'snappy',
  'snappy/package.json',
  'aws4',
  'aws-crt',
  'google-gax',
  'mongodb-client-encryption',
  '@mongodb-js/zstd',
  'encoding',
  // The data files inside 'fast-geoip' package cannot be bundled by webpack, we exclude
  // it from being bundled and put it to a lambda layer instead.
  // To use it in a lambda, add `fastGeoIpLayer` lambda layer to the lambda in cdk-tarpon-stack and
  // dynamically import it in the code.
  'fast-geoip',
  'superagent-proxy',
]

const ROOT_DIR = path.resolve(`${__dirname}/..`)
const OUT_DIR = 'dist'

async function main() {
  console.log('Bundling...')
  console.time('Total build time')
  const entries = fs
    .readdirSync(`${ROOT_DIR}/src/lambdas`)
    .map((lambdaDirName) => `src/lambdas/${lambdaDirName}/app.ts`)

  console.time('Bundle time')
  const bundleResults = await esbuild.build({
    platform: 'node',
    entryPoints: entries,
    bundle: true,
    outdir: OUT_DIR,
    target: 'node18.17.1',
    format: 'cjs',
    minify: true,
    metafile: true,
    logLevel: 'warning',
    sourcemap: 'external',
    minifyIdentifiers: false,
    external: ['aws-sdk', ...builtinModules, ...IGNORED],
  })

  console.log('Generated bundles:')
  for (const [file, info] of Object.entries(bundleResults.metafile.outputs)) {
    console.log(`  ${file}: ${info.bytes.toLocaleString('en-US')} bytes`)
  }
  await fs.writeFile(
    path.join(OUT_DIR, 'meta.json'),
    JSON.stringify(bundleResults.metafile)
  )

  console.timeEnd('Bundle time')

  await Promise.all([
    (async () => {
      // Copy geoip
      await fs.ensureDir(
        `${OUT_DIR}/layers/fast-geoip/nodejs/node_modules/fast-geoip`
      )
      await fs.copy(
        `${ROOT_DIR}/node_modules/fast-geoip`,
        `${OUT_DIR}/layers/fast-geoip/nodejs/node_modules/fast-geoip`
      )
    })(),
    (async () => {
      // Copy slack templates
      await fs.ensureDir(`${OUT_DIR}/slack-app/templates`)
      await fs.copy(
        `${ROOT_DIR}/src/lambdas/slack-app/templates`,
        `${OUT_DIR}/slack-app/templates`
      )
    })(),
    (async () => {
      // Copy fincen binaries
      await fs.ensureDir(`${OUT_DIR}/console-api-sar/bin`)
      fs.copy
      await fs.copy(
        `${ROOT_DIR}/src/services/sar/generators/US/SAR/bin`,
        `${OUT_DIR}/console-api-sar/bin`
      )
    })(),
  ])

  console.timeEnd('Total build time')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
