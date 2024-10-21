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
  'superagent-proxy',
]

const ROOT_DIR = path.resolve(`${__dirname}/..`)
const OUT_DIR = 'dist'

async function copyDirToDist(
  relativeSrc,
  relativeDest,
  validateDestPath = true
) {
  const src = path.join(ROOT_DIR, relativeSrc)
  const dest = path.join(OUT_DIR, relativeDest)
  const destDir = path.parse(dest).dir
  if (validateDestPath && !(await fs.exists(destDir))) {
    throw new Error(`${destDir} does not exist!`)
  }
  await fs.ensureDir(dest)
  await fs.copy(src, dest)
}
async function copyFilesToDist(
  relativeSrc,
  relativeDest,
  validateDestPath = true
) {
  const src = path.join(ROOT_DIR, relativeSrc)
  const dest = path.join(OUT_DIR, relativeDest)
  const destDir = path.parse(dest).dir
  if (validateDestPath && !(await fs.exists(destDir))) {
    throw new Error(`${destDir} does not exist!`)
  }
  await fs.ensureDir(dest)
  await fs.copyFile(src, dest)
}

async function copyDirsToDist(entries) {
  await Promise.all(
    entries.map(({ src, dest, validateDestPath }) =>
      copyDirToDist(src, dest, validateDestPath)
    )
  )
}

async function main() {
  console.log('Bundling...')
  console.time('Total build time')
  const lambdaNames = fs.readdirSync(`${ROOT_DIR}/src/lambdas`)
  const lambdaEntries = lambdaNames.map(
    (lambdaDirName) => `src/lambdas/${lambdaDirName}/app.ts`
  )

  const canaryEntries = fs
    .readdirSync(`${ROOT_DIR}/src/canaries`)
    .map((canaryDirName) => {
      return `src/canaries/${canaryDirName}/index.ts`
    })

  const fargateEntries = fs.readdirSync(`${ROOT_DIR}/src/fargate`).map(() => {
    return `src/fargate/index.ts`
  })

  console.time('Bundle time')

  for (const chunkEntries of [
    [...canaryEntries, ...lambdaEntries.slice(0, lambdaEntries.length / 2)],
    [...fargateEntries, ...lambdaEntries.slice(lambdaEntries.length / 2)],
  ]) {
    const bundleResults = await esbuild.build({
      platform: 'node',
      entryPoints: chunkEntries,
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
      keepNames: true,
    })
    for (const [file, info] of Object.entries(bundleResults.metafile.outputs)) {
      console.log(`  ${file}: ${info.bytes.toLocaleString('en-US')} bytes`)
    }
  }

  console.log('Generated bundles:')
  console.timeEnd('Bundle time')

  await copyDirsToDist([
    // Copy slack templates
    {
      src: 'src/lambdas/slack-app/templates',
      dest: 'lambdas/slack-app/templates',
    },
    // Copy fincen binaries
    {
      src: 'src/services/sar/generators/US/SAR/bin',
      dest: 'lambdas/console-api-sar/bin',
    },
  ])

  // Copy files required for pdfmake library
  for (const lambdaName of lambdaNames) {
    for (const file of ['indic.trie', 'use.trie', 'data.trie']) {
      await fs.copyFile(
        `${ROOT_DIR}/node_modules/@foliojs-fork/fontkit/${file}`,
        `${OUT_DIR}/lambdas/${lambdaName}/${file}`
      )
    }
    await fs.copyFile(
      `${ROOT_DIR}/node_modules/@foliojs-fork/linebreak/src/classes.trie`,
      `${OUT_DIR}/lambdas/${lambdaName}/classes.trie`
    )
    await fs.ensureDir(`${OUT_DIR}/lambdas/${lambdaName}/data`)
    for (const file of [
      'Helvetica-Bold.afm',
      'Helvetica.afm',
      'Helvetica-BoldOblique.afm',
      'Helvetica-Oblique.afm',
    ]) {
      await fs.copyFile(
        `${ROOT_DIR}/node_modules/@foliojs-fork/pdfkit/js/data/${file}`,
        `${OUT_DIR}/lambdas/${lambdaName}/data/${file}`
      )
    }
  }

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
