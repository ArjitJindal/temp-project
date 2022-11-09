import { resolve } from 'path'
import * as fs from 'fs'
import { Configuration } from 'webpack'
import { TsconfigPathsPlugin } from 'tsconfig-paths-webpack-plugin'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const CopyPlugin = require('copy-webpack-plugin')

const config: Configuration = {
  devtool: false,
  parallelism: 10,
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
  externals: [
    // The data files inside 'fast-geoip' package cannot be bundled by webpack, we exclude
    // it from being bundled and copy node_modules/fast-geoip to dist/rules-engine/node_modules/fast-geoip
    'fast-geoip',
  ],
  plugins: [
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
  mode: ['local', 'dev'].includes(process.env.ENV as string)
    ? 'development'
    : 'production',
}

export default config
