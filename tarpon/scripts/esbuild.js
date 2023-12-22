#!/usr/bin/env node
const path = require('path')
const esbuild = require('esbuild')
const fs = require('fs-extra')
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
  'Synthetics',
  'SyntheticsLogger',
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
  const lambdaEntries = fs
    .readdirSync(`${ROOT_DIR}/src/lambdas`)
    .map((lambdaDirName) => `src/lambdas/${lambdaDirName}/app.ts`)

  const canaryEntries = fs
    .readdirSync(`${ROOT_DIR}/src/canaries`)
    .map((canaryDirName) => {
      return `src/canaries/${canaryDirName}/index.ts`
    })

  const fargateEntries = fs.readdirSync(`${ROOT_DIR}/src/fargate`).map(() => {
    return `src/fargate/index.ts`
  })

  const allEntries = [...canaryEntries, ...fargateEntries, ...lambdaEntries]

  console.time('Bundle time')
  const bundleResults = await esbuild.build({
    platform: 'node',
    entryPoints: allEntries,
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
    loader: { '.node': 'file' },
  })

  console.log('Generated bundles:')
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

  for (const [file, info] of Object.entries(bundleResults.metafile.outputs)) {
    console.log(`  ${file}: ${info.bytes.toLocaleString('en-US')} bytes`)
  }
  await fs.writeFile(
    path.join(OUT_DIR, 'meta.json'),
    JSON.stringify(bundleResults.metafile)
  )

  const canaries = fs.readdirSync(`${ROOT_DIR}/dist/canaries`)
  // We need to move canaries to a subfolder as per the requirements of synthetics
  for (const canary of canaries) {
    await fs.move(
      `${ROOT_DIR}/dist/canaries/${canary}/index.js`,
      `${ROOT_DIR}/dist/canaries/${canary}/nodejs/node_modules/index.js`, // The canary resource requires that the handler is present at "nodejs/node_modules"
      { overwrite: true }
    )
  }

  await fs.copy(
    `${ROOT_DIR}/src/fargate/Dockerfile`,
    `${ROOT_DIR}/dist/fargate/Dockerfile`,
    { overwrite: true }
  )

  console.timeEnd('Total build time')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
