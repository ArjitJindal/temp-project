import { resolve } from 'path'
import * as fs from 'fs'
import { Configuration } from 'webpack'

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
  module: {
    rules: [
      { test: /\.ts$/, loader: 'ts-loader' },
      {
        test: /\.node$/i,
        use: 'raw-loader',
      },
    ],
  },
  resolve: {
    extensions: ['.js', '.ts'],
  },
  target: 'node',
  mode: process.env.NODE_ENV === 'dev' ? 'development' : 'production',
}

export default config
