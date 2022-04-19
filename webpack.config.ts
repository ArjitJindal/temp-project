import { resolve } from 'path'
import * as fs from 'fs'
import { Configuration } from 'webpack'
import { TsconfigPathsPlugin } from 'tsconfig-paths-webpack-plugin'

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
}

export default config
