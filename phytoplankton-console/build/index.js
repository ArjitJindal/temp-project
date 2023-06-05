/* eslint-disable */
const path = require('path');
const {
  log,
  error,
  readConfig,
  prepare,
  buildStatic,
  buildHtml,
  buildCode,
} = require('./build-tasks.js');
const express = require('express');
const fallback = require('express-history-api-fallback');
const fs = require('fs-extra');
const { notify } = require('./helpers.js');

const SCRIPT_DIR = __dirname;

const env = {
  WATCH: process.env.WATCH === 'true' ?? false,
  ENV: process.env.ENV ?? 'prod',
  SCRIPT_DIR: SCRIPT_DIR,
  PROJECT_DIR: path.resolve(SCRIPT_DIR, '..'),
  SRC_FOLDER: 'src',
  OUTPUT_FOLDER: 'dist',
};

function serve() {
  const port = parseInt(process.env.SERVER_PORT || 8001);
  const folder = path.join(env.PROJECT_DIR, env.OUTPUT_FOLDER);

  const app = express();
  app.use(express.static(process.env.SERVE_DIRECTORY || folder));
  app.use(fallback('index.html', { root: folder }));
  app.get('/', function (req, res) {
    return res.end('<p>This server serves up static files.</p>');
  });

  /*
  openssl genrsa -out build/certificates/self_priv.pem 1024
  openssl req -new -key build/certificates/self_priv.pem -out build/certificates/certrequest.csr
  openssl x509 -req -in build/certificates/certrequest.csr -signkey build/certificates/self_priv.pem -out build/certificates/self_cert.pem
  */
  const USE_HTTPS = true;

  const options = {
    passphrase: process.env.HTTPS_PASSPHRASE || '',
  };

  if (USE_HTTPS) {
    options.key = fs.readFileSync(
      path.resolve(SCRIPT_DIR, 'certificates', 'self_priv.pem'),
      'utf8',
    );
    options.cert = fs.readFileSync(
      path.resolve(SCRIPT_DIR, 'certificates', 'self_cert.pem'),
      'utf8',
    );
  }

  const http = USE_HTTPS ? require('https') : require('http');
  const server = http.createServer(options, app);
  log(`Serving files on ${USE_HTTPS ? 'https' : 'http'}://flagright.local:${port}...`);
  server.listen(port);
}

async function main() {
  const bundleBaseName = `bundle.${Date.now()}`;
  const bundleJs = `${bundleBaseName}.js`;
  const bundleCss = `${bundleBaseName}.css`;

  const config = await readConfig(env);
  log(`Env: ${env.ENV}`);
  if (env.WATCH) {
    log(`Running initial build...`);
  } else {
    log(`Running build...`);
  }
  await prepare(env);
  await buildHtml(env, {
    file: 'index.html',
    context: {
      bundleJs: bundleJs,
      bundleCss: bundleCss,
    },
  });
  await buildStatic(env);
  const buildResult = await buildCode(env, {
    entry: 'app.tsx',
    outFile: bundleJs,
    config,
    watch: env.WATCH,
  });
  if (buildResult.metafile) {
    await fs.writeJson(path.resolve(env.PROJECT_DIR, 'esbuild.json'), buildResult.metafile);
  }
  if (env.WATCH) {
    log('Build finished, watching for changes');
    notify('Build finished, watching for changes');
    serve();
  } else {
    log('Build finished');
    notify('Build finished');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
