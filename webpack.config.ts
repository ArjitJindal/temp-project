import { resolve } from 'path'
import * as fs from 'fs'
import { Configuration } from 'webpack'
import { TsconfigPathsPlugin } from 'tsconfig-paths-webpack-plugin'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const CopyPlugin = require('copy-webpack-plugin')

const isDevMode = process.env.ENV === 'local' || process.env.ENV === 'dev:user'

const lambdaEntries = fs
  .readdirSync('./src/lambdas')
  .map((lambdaDirName) => [
    lambdaDirName,
    `./src/lambdas/${lambdaDirName}/app.ts`,
  ])

function getConfigChunk(
  entries: string[][],
  isLastChunk: boolean
): Configuration {
  const plugins = isLastChunk
    ? [
        new CopyPlugin({
          patterns: [
            {
              from: 'node_modules/fast-geoip',
              to: 'layers/fast-geoip/nodejs/node_modules/fast-geoip',
            },
          ],
        }),
        new CopyPlugin({
          patterns: [
            {
              from: 'src/lambdas/slack-app/templates',
              to: 'slack-app/templates',
            },
          ],
        }),
      ]
    : []
  return {
    // NOTE: We don't need devtool for local dev as we use ts-node-dev
    devtool: isDevMode ? false : 'source-map',
    entry: Object.fromEntries(entries),
    output: {
      filename: '[name]/app.js',
      libraryTarget: 'commonjs2',
      path: resolve(__dirname, 'dist'),
    },
    externals: [
      // The data files inside 'fast-geoip' package cannot be bundled by webpack, we exclude
      // it from being bundled and copy node_modules/fast-geoip to dist/rules-engine/node_modules/fast-geoip
      'fast-geoip',
    ],
    plugins,
    module: {
      rules: [
        { test: /\.ts$/, loader: 'ts-loader' },
        {
          test: /\.node$/,
          use: 'raw-loader',
        },
      ],
    },
    resolve: {
      extensions: ['.js', '.ts'],
      plugins: [new TsconfigPathsPlugin()],
    },
    target: 'node',
    mode: isDevMode ? 'development' : 'production',
  }
}

// IMPORTANT: We're using 15GB memory for the building codebuild project. Increase NUM_CHUNKS and
// add one more 'CHUNK=N webpack' for 'npm run build' if we hit OOM again.
const NUM_CHUNKS = 3

const step = Math.ceil(lambdaEntries.length / NUM_CHUNKS)
if (process.env.CHUNK == null) {
  throw new Error(`Please specify CHUNK env var 0..${NUM_CHUNKS - 1}`)
}
const chunk = Number(process.env.CHUNK)

export default getConfigChunk(
  lambdaEntries.slice(step * chunk, step * (chunk + 1)),
  chunk === NUM_CHUNKS - 1
)
