/* eslint-disable */
const fs = require('fs-extra');
const esbuild = require('esbuild');
const sentryEsbuildPlugin = require('@sentry/esbuild-plugin').default;
const path = require('path');
const { execSync } = require('child_process');
const LessImportResolvePlugin = require('./less-import-resolve-plugin.js');
const lessPlugin = require('./esbuild-plugin-less-loader.js');
const svgrPlugin = require('./esbuild-plugin-svgr.js');
const cssModulesPlugin = require('./esbuild-plugin-css-modules.js');
const resolveVirtuals = require('./esbuild-plugin-resolve-virtuals.js');
const { log, error, notify } = require('./helpers.js');
const parse = require('json-templates');

async function prepare(env) {
  await fs.rm(path.resolve(env.PROJECT_DIR, env.OUTPUT_FOLDER), { recursive: true, force: true });
  await fs.rm(path.resolve(env.PROJECT_DIR, 'esbuild.json'), { recursive: true, force: true });
  await fs.mkdir(path.resolve(env.PROJECT_DIR, env.OUTPUT_FOLDER));
}

async function readConfig(env) {
  if (env.ENV === 'dev' && process.env.GITHUB_USER) {
    const stringConfig = await fs.readFile(
      path.resolve(env.PROJECT_DIR, `config/config.${env.ENV}-user.json`),
      { encoding: 'utf-8' },
    );
    const template = parse(stringConfig);
    const githubUser = process.env.GITHUB_USER.toLowerCase();
    const serialNumber = process.env.S_NO || '1';
    return JSON.parse(template({ githubUser, serialNumber }));
  }
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
    return result.toString();
  } catch (e) {
    console.error(
      `Unable to get Git hash for last commit, trying to use CODEBUILD_RESOLVED_SOURCE_VERSION env variable. Fail reason: "${e.message}"`,
    );
    if (process.env.CODEBUILD_RESOLVED_SOURCE_VERSION) {
      return process.env.CODEBUILD_RESOLVED_SOURCE_VERSION;
    }
    console.error(
      `Unable to get CODEBUILD_RESOLVED_SOURCE_VERSION (it's empty) use 'latest' instead`,
    );
    return 'latest';
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
  const devMode = (process.env.MODE ?? config.mode) === 'development';
  const envName = config.envName ?? 'unknown_env';
  const releaseSuffix =
    process.env.ENV === 'dev' || process.env.ENV === 'sandbox'
      ? 'latest-version'
      : getGitHeadHash();
  const release = `phytoplankton#${releaseSuffix}`;
  return await esbuild.build({
    entryPoints: [path.join(SRC_FOLDER, entry)],
    bundle: true,
    // logLevel: "verbose",
    loader: {
      '.svg': 'file',
    },
    define: {
      'process.env.RELEASE': JSON.stringify(release),
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
      lessPlugin(
        {
          javascriptEnabled: true,
          plugins: lessPlugins,
        },
        {
          rootDir: PROJECT_DIR,
        },
      ),
      cssModulesPlugin(),
      svgrPlugin(),
      resolveVirtuals(),

      ...(devMode || !process.env.SENTRY_UPLOAD
        ? []
        : [
            // let sentry plugin be the last one
            sentryEsbuildPlugin({
              org: 'flagright-data-technologies-in',
              project: 'phytoplankton-console',
              release,
              include: './dist',
            }),
          ]),
    ],
    outfile: path.join(PROJECT_DIR, OUTPUT_FOLDER, outFile),
    mainFields: ['module', 'browser', 'main'],
    target: ['chrome102', 'firefox100', 'safari14'],
    inject: [path.join(env.SCRIPT_DIR, 'react-shim.js')],
    assetNames: 'public/[name].[hash]',
    publicPath: '/',
    minify: !devMode,
    metafile: !devMode,
    sourcemap: devMode || 'external',
    treeShaking: !devMode,
    watch: watch
      ? {
          onRebuild(e, result) {
            if (e) {
              notify(`ERROR: ${e.message || 'Unknown error'}`);
              error(`Watch build failed:`, e);
            } else {
              notify('Re-built successfully');
              log('Re-built successfully');
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
