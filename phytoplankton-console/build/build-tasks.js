/* eslint-disable */
const fs = require('fs-extra');
const esbuild = require('esbuild');
const path = require('path');
const { execSync } = require('child_process');
const LessImportResolvePlugin = require('./less-import-resolve-plugin.js');
const lessPlugin = require('./esbuild-plugin-less-loader.js');
const svgrPlugin = require('./esbuild-plugin-svgr.js');
const cssModulesPlugin = require('./esbuild-plugin-css-modules.js');
const fontsPlugin = require('./esbuild-plugin-fonts');
const resolveVirtuals = require('./esbuild-plugin-resolve-virtuals.js');
const { log, error, notify } = require('./helpers.js');
const parse = require('json-templates');

async function prepare(env) {
  await fs.rm(path.resolve(env.PROJECT_DIR, env.OUTPUT_FOLDER), { recursive: true, force: true });
  await fs.rm(path.resolve(env.PROJECT_DIR, 'esbuild.json'), { recursive: true, force: true });
  await fs.mkdir(path.resolve(env.PROJECT_DIR, env.OUTPUT_FOLDER));
}

async function readConfig(env) {
  if (env.ENV === 'dev' && process.env.QA_SUBDOMAIN) {
    const stringConfig = await fs.readFile(
      path.resolve(env.PROJECT_DIR, `config/config.${env.ENV}-user.json`),
      { encoding: 'utf-8' },
    );
    const template = parse(stringConfig);
    const qaSubdomain = process.env.QA_SUBDOMAIN.toLowerCase();
    return JSON.parse(template({ qaSubdomain }));
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
    return result.toString().trim();
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
  const devMode = watch || config.mode === 'development';
  const envName = config.envName ?? 'unknown_env';
  const commitHash = getGitHeadHash();
  const releaseSuffix = process.env.ENV === 'dev' ? 'latest-version' : commitHash;
  const release = `phytoplankton:${releaseSuffix}`;
  const define = config.define;

  if (process.env.QA === 'true' && !process.env.TARPON_BRANCH) {
    define['API_BASE_PATH'] = null;
  }

  async function writeFiles(buildResult) {
    await Promise.all(
      buildResult.outputFiles.map(async (file) => {
        // ignore chunk css files since they are already included in main css file
        if (/chunks\/.*\.css$/.test(file.path) || /chunks\/.*\.css.map$/.test(file.path)) {
          return;
        }
        await fs.outputFile(file.path, file.contents);
      }),
    );
  }

  const result = await esbuild.build({
    entryPoints: [path.join(SRC_FOLDER, entry)],
    entryNames: outFile,
    bundle: true,
    logLevel: 'error',
    loader: {
      '.svg': 'file',
      '.png': 'file',
      '.ttf': 'file',
    },
    define: {
      'process.env.RELEASE': JSON.stringify(release),
      'process.env.NODE_ENV': JSON.stringify(devMode ? 'development' : 'production'),
      'process.env.ENV_NAME': JSON.stringify(envName),
      'process.env.__IS_SERVER': false,
      'process.env.NODE_DEBUG': false,
      ...Object.entries(define).reduce(
        (acc, [key, value]) => ({ ...acc, [key]: JSON.stringify(value) }),
        {},
      ),
    },
    plugins: [
      ...(watch
        ? [
            {
              name: 'watch',
              setup: (build) => {
                build.onStart(() => {
                  log('Re-building started...');
                });
              },
            },
          ]
        : []),
      fontsPlugin(
        {},
        {
          rootDir: PROJECT_DIR,
        },
      ),
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
      svgrPlugin({
        ref: true,
      }),
      resolveVirtuals(),
    ],
    outdir: path.join(PROJECT_DIR, OUTPUT_FOLDER),
    mainFields: ['module', 'browser', 'main'],
    target: ['chrome102', 'firefox100', 'safari14'],
    format: 'esm',
    splitting: true,
    inject: [path.join(env.SCRIPT_DIR, 'react-shim.js')],
    chunkNames: 'chunks/[name].[hash]',
    assetNames: 'public/[name].[hash]',
    publicPath: '/',
    minify: !devMode,
    metafile: true,
    sourcemap: devMode || 'external',
    treeShaking: !devMode,
    write: false,
    watch: watch
      ? {
          onRebuild: (e, result) => {
            (e ? Promise.reject(e) : writeFiles(result)).then(
              () => {
                notify('Re-built successfully');
                log('Re-built successfully');
              },
              () => {
                notify(`ERROR: ${e.message || 'Unknown error'}`);
                error(`Watch build failed:`, e);
              },
            );
          },
        }
      : null,
  });
  await writeFiles(result);

  if (!devMode && process.env.SENTRY_UPLOAD) {
    uploadSentrySourceMaps(release, commitHash);
  }
  return result;
}

function uploadSentrySourceMaps(release, commitHash) {
  process.env.SENTRY_ORG = 'flagright-data-technologies-in';
  process.env.SENTRY_PROJECT = 'phytoplankton-console';

  execSync(
    `./node_modules/.bin/sentry-cli releases set-commits ${release} --commit flagright/orca@${commitHash}`,
    { stdio: 'inherit' },
  );
  execSync(`./node_modules/.bin/sentry-cli releases finalize ${release}`, { stdio: 'inherit' });
  execSync(`./node_modules/.bin/sentry-cli sourcemaps inject dist`, { stdio: 'inherit' });
  execSync(
    `./node_modules/.bin/sentry-cli sourcemaps upload --release=${release} --ext js --ext map dist`,
    {
      stdio: 'inherit',
    },
  );
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
