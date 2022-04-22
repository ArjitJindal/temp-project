import { resolve } from 'path'
import * as fs from 'fs'
import { Configuration } from 'webpack'
import { TsconfigPathsPlugin } from 'tsconfig-paths-webpack-plugin'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const CopyPlugin = require('copy-webpack-plugin')

const config: Configuration = {
  entry: Object.fromEntries(
    fs
      .readdirSync('./src/lambdas')
      .map((lambdaDirName) => [
        lambdaDirName,
        `./src/lambdas/${lambdaDirName}/app.ts`,
      ])
  ),
  output: {
    filename: '[name]/app.js',
    libraryTarget: 'commonjs2',
    path: resolve(__dirname, 'dist'),
  },
  plugins: [
    // TODO: re-enable the plugin after we move fast-geoip to lambda layer
    // new CopyPlugin({
    //   patterns: [
    //     {
    //       from: 'node_modules/fast-geoip',
    //       to: 'rules-engine/node_modules/fast-geoip',
    //     },
    //   ],
    // }),
  ],
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
  mode: process.env.ENV === 'prod' ? 'production' : 'development',
  externals: [
    // The data files inside 'fast-geoip' package cannot be bundled by webpack, we exclude
    // it from being bundled and copy node_modules/fast-geoip to dist/rules-engine/node_modules/fast-geoip
    'fast-geoip',
  ],
}

export default config
