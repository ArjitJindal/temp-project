/* eslint-disable */
const fs = require('fs-extra');
const esbuild = require('esbuild');
const path = require('path');
const { execSync } = require('child_process');
const LessImportResolvePlugin = require('./less-import-resolve-plugin.js');
const lessLoader = require('./less-loader.js');

function log(message, ...args) {
  console.log(`[${new Date().toISOString()}] ${message}`, ...args);
}

function error(message, ...args) {
  console.error(`[${new Date().toISOString()}] ${message}`, ...args);
}


async function prepare(env) {
  await fs.rm(path.resolve(env.PROJECT_DIR, env.OUTPUT_FOLDER), { recursive: true, force: true });
  await fs.mkdir(path.resolve(env.PROJECT_DIR, env.OUTPUT_FOLDER));
}

async function readConfig(env) {
  return await fs.readJson(path.resolve(env.PROJECT_DIR, `config/config.${env.ENV}.json`));
}

async function buildHtml(env, options) {
  const { file, context } = options;
  const { PROJECT_DIR, SRC_FOLDER, OUTPUT_FOLDER } = env;
  let fileContent = await fs.readFile(path.join(PROJECT_DIR, SRC_FOLDER, 'index.html'));
  fileContent = fileContent
    .toString()
    .replace(/{{\s*(.*?)\s*}}/g, (_, varName) => context[varName]);
  await fs.writeFile(path.join(OUTPUT_FOLDER, file), fileContent);
}

async function buildStatic(env) {
  const { PROJECT_DIR, SRC_FOLDER, OUTPUT_FOLDER } = env;
  await fs.copy(
    path.join(PROJECT_DIR, SRC_FOLDER, 'static'),
    path.join(PROJECT_DIR, OUTPUT_FOLDER),
  );
}

function getGitHeadHash() {
  try {
    const result = execSync('git rev-parse HEAD', { stdio: 'pipe' });
    return result.toString()
  } catch (e) {
    console.error(`Unable to get Git hash for last commit, use 'latest' instead. Reason: "${e.message}"`)
    return 'latest'
  }
}

async function buildCode(env, options) {
  const { PROJECT_DIR, SRC_FOLDER, OUTPUT_FOLDER } = env;
  const { entry, outFile, watch, config } = options;
  const lessPlugins = [
    new LessImportResolvePlugin({
      nodeModules: PROJECT_DIR + '/node_modules/',
    }),
  ];
  const devMode = config.mode === 'development';
  const envName = config.envName ?? 'unknown_env';
  return await esbuild.build({
    entryPoints: [path.join(SRC_FOLDER, entry)],
    bundle: true,
    loader: {
      '.svg': 'file',
    },
    define: {
      'process.env.GIT_HEAD_SHA': JSON.stringify(getGitHeadHash()),
      'process.env.NODE_ENV': JSON.stringify(devMode ? 'development' : 'production'),
      'process.env.ENV_NAME': JSON.stringify(envName),
      'process.env.__IS_SERVER': false,
      'process.env.NODE_DEBUG': false,
      ...Object.entries(config.define).reduce(
        (acc, [key, value]) => ({ ...acc, [key]: JSON.stringify(value) }),
        {},
      ),
    },
    plugins: [
      lessLoader(
        {
          javascriptEnabled: true,
          plugins: lessPlugins,
        },
        {
          rootDir: PROJECT_DIR,
        },
      ),
    ],
    outfile: path.join(PROJECT_DIR, OUTPUT_FOLDER, outFile),
    mainFields: ['browser', 'main'],
    target: ['chrome102', 'firefox100', 'safari14'],
    inject: [path.join(env.SCRIPT_DIR, 'react-shim.js')],
    assetNames: 'public/[name].[hash]',
    publicPath: '/',
    minify: !devMode,
    metafile: !devMode,
    sourcemap: !devMode,
    // incremental: watch, // todo: migration: use it
    watch: watch
      ? {
          onRebuild(error, result) {
            if (error) {
              console.error(`Watch build failed:`, error);
            } else {
              log(`Watch build succeeded!`);
            }
          },
        }
      : null,
  });
}

module.exports = {
  log,
  error,
  prepare,
  readConfig,
  buildStatic,
  buildHtml,
  buildCode,
};
