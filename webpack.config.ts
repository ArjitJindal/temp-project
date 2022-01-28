import { resolve } from 'path'
import { Configuration } from 'webpack'

const config: Configuration = {
  entry: {
    'api-key-generator': './src/api-key-generator/app.ts',
    authorizer: './src/authorizer/app.ts',
    'rules-engine': './src/rules-engine/app.ts',
    'user-management': './src/user-management/app.ts',
    'list-importer': './src/list-importer/app.ts',
  },
  output: {
    filename: '[name]/app.js',
    libraryTarget: 'commonjs2',
    path: resolve(__dirname, 'dist'),
  },
  module: {
    rules: [{ test: /\.ts$/, loader: 'ts-loader' }],
  },
  resolve: {
    extensions: ['.js', '.ts'],
  },
  target: 'node',
  mode: process.env.NODE_ENV === 'dev' ? 'development' : 'production',
}

export default config
