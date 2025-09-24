#!/usr/bin/env node
const path = require('path')
const esbuild = require('esbuild')
const fs = require('fs-extra')
const { chunk } = require('lodash')
const builtinModules = require('builtin-modules')
const { execSync } = require('child_process')

// --- Added: CLI trace flag ---
// TRACE IMPORTS = node scripts/esbuild.js --trace src/utils/clickhouse/definition.ts
const TRACE_PACKAGE = process.argv.includes('--trace')
  ? process.argv[process.argv.indexOf('--trace') + 1]
  : null

// These are transitive dependencies of our dependencies...
const IGNORED = [
  'coffee-script',
  '@google-cloud/common',
  'kerberos',
  'bson-ext',
  'snappy',
  'snappy/package.json',
  'aws-crt',
  'google-gax',
  'mongodb-client-encryption',
  '@mongodb-js/zstd',
  'encoding',
  'Synthetics',
  'SyntheticsLogger',
  'superagent-proxy',
  'highlight.js',
  '@/core/local-handlers/*',
  '@/utils/local-dynamodb-change-handler',
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

async function copyDirsToDist(entries) {
  await Promise.all(
    entries.map(({ src, dest, validateDestPath }) =>
      copyDirToDist(src, dest, validateDestPath)
    )
  )
}

// --- Added: trace helper ---
function traceImport(metafile, target) {
  const results = []
  for (const [input, info] of Object.entries(metafile.inputs)) {
    for (const imp of info.imports || []) {
      if (imp.path.includes(target)) {
        results.push({ importer: input, import: imp.path })
      }
    }
  }
  return results
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
    .map((canaryDirName) => `src/canaries/${canaryDirName}/index.ts`)

  const fargateEntries = fs.readdirSync(`${ROOT_DIR}/src/fargate`).map(() => {
    return `src/fargate/index.ts`
  })

  console.time('Bundle time')

  const trieFiles = ['indic.trie', 'use.trie', 'data.trie']
  const fontFiles = [
    'Helvetica-Bold.afm',
    'Helvetica.afm',
    'Helvetica-BoldOblique.afm',
    'Helvetica-Oblique.afm',
  ]

  const fileOutDirMap = {
    'src/lambdas': {
      entries: chunk(lambdaEntries, lambdaEntries.length / 4),
      outDir: 'dist/lambdas',
    },
    'src/canaries': {
      entries: canaryEntries.map((entry) => [entry]),
      outDir: 'dist/canaries',
    },
    'src/fargate': {
      entries: fargateEntries.map((entry) => [entry]),
      outDir: 'dist/fargate',
    },
  }

  if (
    lambdaEntries.length !== fileOutDirMap['src/lambdas'].entries.flat().length
  ) {
    throw new Error('Lambda entries length mismatch')
  }

  if (canaryEntries.length !== fileOutDirMap['src/canaries'].entries.length) {
    throw new Error('Canary entries length mismatch')
  }

  if (fargateEntries.length !== fileOutDirMap['src/fargate'].entries.length) {
    throw new Error('Fargate entries length mismatch')
  }

  for (const { entries, outDir } of Object.values(fileOutDirMap)) {
    for (const chunkEntries of entries) {
      const bundleResults = await esbuild.build({
        platform: 'node',
        entryPoints: chunkEntries,
        bundle: true,
        outdir:
          chunkEntries.length === 1 && !chunkEntries[0].includes('fargate')
            ? `${outDir}/${chunkEntries[0].split('/')[2]}`
            : outDir,
        target: 'node20.9.0',
        format: 'cjs',
        minify: true,
        metafile: true,
        logLevel: 'warning',
        sourcemap: 'external',
        minifyIdentifiers: false,
        treeShaking: true,
        external: [
          'aws-sdk',
          ...(outDir.includes('fargate') ? [] : ['@aws-sdk/*']),
          ...builtinModules.filter((mod) => mod !== 'punycode'),
          ...IGNORED,
          'aws-cdk-lib',
          '../lib/node_modules/aws-cdk-lib/*',
          ...(outDir.includes('fargate')
            ? []
            : ['pdf2json', 'xlsx-js-style', 'html-to-docx', 'pdfmake']),
        ],
        loader: { '.node': 'file' },
        keepNames: true,
      })

      for (const [file, info] of Object.entries(
        bundleResults.metafile.outputs
      )) {
        console.log(`\n${file}: ${info.bytes.toLocaleString()} bytes`)

        const inputs = Object.entries(info.inputs)
          .map(([input, { bytesInOutput }]) => ({ input, size: bytesInOutput }))
          .sort((a, b) => b.size - a.size)
          .slice(0, 20)

        for (const { input, size } of inputs) {
          console.log(`   - ${input}: ${size.toLocaleString()} bytes`)
        }

        // --- Added: run trace if requested for each file ---
        if (TRACE_PACKAGE) {
          console.log(
            `\n🔎 Tracing imports for "${TRACE_PACKAGE}" in ${file}...`
          )
          const traces = traceImport(bundleResults.metafile, TRACE_PACKAGE)
          if (traces.length === 0) {
            console.log(`   (No imports found for "${TRACE_PACKAGE}")`)
          } else {
            traces.forEach((t) => console.log(`   ${t.importer} → ${t.import}`))
          }
        }
      }
    }
  }

  console.log('Generated bundles:')
  console.timeEnd('Bundle time')

  await copyDirsToDist([
    {
      src: 'src/lambdas/slack-app/templates',
      dest: 'lambdas/slack-app/templates',
    },
    {
      src: 'src/services/sar/generators/US/SAR/bin',
      dest: 'lambdas/console-api-sar/bin',
    },
  ])

  // Copy files required for pdfmake library
  for (const lambdaName of lambdaNames) {
    for (const file of trieFiles) {
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
    for (const file of fontFiles) {
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

  for (const file of trieFiles) {
    await fs.copy(
      `${ROOT_DIR}/node_modules/@foliojs-fork/fontkit/${file}`,
      `${OUT_DIR}/fargate/${file}`
    )
  }

  await fs.copy(
    `${ROOT_DIR}/node_modules/@foliojs-fork/linebreak/src/classes.trie`,
    `${OUT_DIR}/fargate/classes.trie`
  )

  for (const file of fontFiles) {
    await fs.copy(
      `${ROOT_DIR}/node_modules/@foliojs-fork/pdfkit/js/data/${file}`,
      `${OUT_DIR}/fargate/data/${file}`
    )
  }

  await buildLambdaLayer()
  console.timeEnd('Total build time')
}

const LAYER_PACKAGES = ['pdf2json', 'xlsx-js-style', 'html-to-docx', 'pdfmake']
const LAYER_DIR = path.join(ROOT_DIR, 'dist/layers/heavy-libs/nodejs')

async function buildLambdaLayer() {
  console.log('📚 Building Lambda Layer...')
  const rootPkg = await fs.readJson(path.join(ROOT_DIR, 'package.json'))
  const deps = rootPkg.dependencies || {}
  const layerDeps = {}
  for (const pkg of LAYER_PACKAGES) {
    if (!deps[pkg]) {
      throw new Error(
        `❌ Package "${pkg}" is not listed in root package.json dependencies`
      )
    }
    layerDeps[pkg] = deps[pkg]
  }
  const layerPkg = {
    name: 'heavy-libs-layer',
    version: '1.0.0',
    private: true,
    dependencies: layerDeps,
  }
  await fs.remove(LAYER_DIR)
  await fs.ensureDir(LAYER_DIR)
  await fs.writeJson(path.join(LAYER_DIR, 'package.json'), layerPkg, {
    spaces: 2,
  })
  console.log(`📥 Installing ${Object.keys(layerDeps).join(', ')}`)
  execSync(`npm install --production`, { cwd: LAYER_DIR, stdio: 'inherit' })
  console.log('✅ Layer built at:', LAYER_DIR)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
