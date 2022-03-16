import { resolve } from 'path'
import * as fs from 'fs'
import { Configuration } from 'webpack'

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
    new CopyPlugin({
      patterns: [
        {
          from: 'src/ca/rds-combined-ca-bundle.pem',
          to: 'tarpon-change-capture-kinesis-consumer/rds-combined-ca-bundle.pem',
        },
        {
          from: 'src/ca/rds-combined-ca-bundle.pem',
          to: 'api-key-generator/rds-combined-ca-bundle.pem',
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
  },
  target: 'node',
  mode: process.env.ENV === 'prod' ? 'production' : 'development',
}

export default config
