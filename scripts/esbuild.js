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
  'encoding',
]

// I use custom resolver because esbuild doesn't resolve modules from nested `node_modules` directories, and it looks like
// it's an expected behaviour. This plugin provides default node resolution strategy
const customResolvePlugin = {
  name: 'custom resolver',
  setup(build) {
    const resolver = enhancedResolve.create({
      extensions: ['.ts', '.js', '.json'],
      exportsFields: [],
    })
    const skipResolve = {}
    build.onResolve({ filter: /^.*$/ }, async (args) => {
      // This is needed to prevent infinite loop
      if (args.pluginData === skipResolve) {
        return
      }
      // Mark as external node's builtin modules and ignored modules
      if (
        builtinModules.includes(args.path) ||
        IGNORED.includes(args.path)
      ) {
        return {
          external: true,
        }
      }
      try {
        const customResolveResult = await new Promise((resolve, reject) => {
          resolver(args.resolveDir, args.path, (err, result) => {
            if (err) {
              reject(err)
            } else {
              resolve(result)
            }
          })
        })
        return {
          path: customResolveResult,
        }
      } catch (e) {
        // ignore
      }

      // If custom resolver failed, try to resolve using esbuild's resolver
      return await build.resolve(args.path, {
        resolveDir: args.resolveDir,
        pluginData: skipResolve,
      })
    })
  },
}

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
    target: 'node16.13.1',
    format: 'cjs',
    minify: true,
    metafile: true,
    logLevel: 'warning',
    sourcemap: 'external',
    plugins: [customResolvePlugin],
  })

  console.log('Generated bundles:')
  for (const [file, info] of Object.entries(bundleResults.metafile.outputs)) {
    console.log(`  ${file}: ${info.bytes.toLocaleString('en-US')} bytes`)
  }

  console.timeEnd('Bundle time')

  // Copy geoip
  await Promise.all([
    (async () => {
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
  ])

  console.timeEnd('Total build time')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
