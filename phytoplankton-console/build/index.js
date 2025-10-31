/* eslint-disable */
const path = require('path');
const crypto = require('crypto');
const { uniq } = require('lodash');
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
const https = require('node:https');
const { Metafile } = require('esbuild');
const brandingJson = require('@flagright/lib/config/config-branding-json.json');
const { execSync } = require('child_process');
const SCRIPT_DIR = __dirname;

const env = {
  WATCH: process.env.WATCH === 'true' ?? false,
  ENV: process.env.ENV ?? 'prod',
  SCRIPT_DIR: SCRIPT_DIR,
  PROJECT_DIR: path.resolve(SCRIPT_DIR, '..'),
  SRC_FOLDER: 'src',
  OUTPUT_FOLDER: 'dist',
};

const WHITE_LABEL_DOMAINS = Object.values(brandingJson)
  .flatMap(
    (brandSettings) =>
      Object.values(brandSettings.consoleSettings).flatMap(
        (envSettings) => envSettings.allowedDomains ?? [],
      ) ?? [],
  )
  .map((v) => `https://${v}`)
  .join(' ');

function serve() {
  const port = parseInt(process.env.SERVER_PORT || 8001);
  const folder = path.join(env.PROJECT_DIR, env.OUTPUT_FOLDER);

  const app = express();

  // Add security headers middleware
  app.use((req, res, next) => {
    // Apply security headers to all responses
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), camera=(), microphone=()');

    // Set Content-Type only for specific file types that need it
    if (req.url === '/' || req.url.endsWith('.html') || req.url === '/index.html') {
      res.setHeader('Content-Type', 'text/html; charset=UTF-8');
    } else if (req.url.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
    } else if (req.url.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css; charset=UTF-8');
    } else if (req.url.endsWith('.json')) {
      res.setHeader('Content-Type', 'application/json; charset=UTF-8');
    } else if (req.url.endsWith('.xml')) {
      res.setHeader('Content-Type', 'application/xml; charset=UTF-8');
    } else if (req.url.endsWith('.txt')) {
      res.setHeader('Content-Type', 'text/plain; charset=UTF-8');
    }
    next();
  });

  app.use(express.static(process.env.SERVE_DIRECTORY || folder));
  app.use(fallback('index.html', { root: folder }));
  app.get('/', function (req, res) {
    return res.end('<p>This server serves up static files.</p>');
  });
  app.put('/fake/url', function (req, res) {
    return res.status(200).end('ok');
  });

  /*
  openssl genrsa -out build/certificates/self_priv.pem 2048
  openssl req -new -key build/certificates/self_priv.pem -out build/certificates/certrequest.csr
  openssl x509 -req -in build/certificates/certrequest.csr -signkey build/certificates/self_priv.pem -out build/certificates/self_cert.pem
  rm build/certificates/certrequest.csr
  */
  const options = {
    passphrase: process.env.HTTPS_PASSPHRASE || '',
    key: fs.readFileSync(path.resolve(SCRIPT_DIR, 'certificates', 'self_priv.pem'), 'utf8'),
    cert: fs.readFileSync(path.resolve(SCRIPT_DIR, 'certificates', 'self_cert.pem'), 'utf8'),
  };
  const server = https.createServer(options, app);
  log(`Serving files on https://flagright.local:${port}...`);
  server.listen(port);
}
async function main() {
  const latestCommit = execSync('git rev-parse --short HEAD').toString().trim();
  const hotReload = process.argv[2] === '--hotReload' ? true : false;
  const bundleBaseName = `bundle-${latestCommit}`;
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
  await buildStatic(env);
  const buildResult = await buildCode(env, {
    entry: 'app.tsx',
    outFile: bundleBaseName,
    config,
    watch: env.WATCH,
    hotReload: hotReload,
  });
  await fs.writeJson(path.resolve(env.PROJECT_DIR, 'esbuild.json'), buildResult.metafile);
  const randomHash = crypto.randomBytes(16).toString('hex');
  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'strict-dynamic' https://eu-assets.i.posthog.com blob: 'nonce-${randomHash}'${
      hotReload ? ' http://localhost:35729' : ''
    }`,
    `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://widget.freshworks.com/`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `connect-src 'self'${
      env.ENV === 'local' ? ' http://localhost:3002 ' : ' '
    }*.amazonaws.com https://eu.i.posthog.com https://*.flagright.dev https://*.flagright.com https://ipinfo.io https://*.ingest.sentry.io https://fonts.gstatic.com ${WHITE_LABEL_DOMAINS}${
      hotReload ? ' ws://localhost:35729' : ''
    } https://api-iam.intercom.io https://i1.wp.com https://js.intercomcdn.com/* wss://nexus-websocket-a.intercom.io/ https://widget.freshworks.com https://flagright.freshdesk.com`,
    `font-src 'self' https://fonts.gstatic.com https://fonts.intercomcdn.com`,
    `frame-src 'self' https://*.flagright.com https://*.flagright.dev ${WHITE_LABEL_DOMAINS} https://connect.nango.dev/  https://api-iam.intercom.io https://i1.wp.com https://js.intercomcdn.com/* https://widget.freshworks.com https://flagright.freshdesk.com`,
    `img-src 'self' data: https://cdn.auth0.com https://s.gravatar.com https://*.wp.com https://cdnjs.cloudflare.com https://platform.slack-edge.com https://www.acurisriskintelligence.com/ https://js.intercomcdn.com/ https://downloads.intercomcdn.com https://static.intercomassets.com https://widget.freshworks.com`,
    `manifest-src 'self'`,
    `media-src 'self'`,
    `worker-src blob:`,
  ].join(';');

  await buildHtml(env, {
    file: 'index.html',
    context: {
      bundleJs: bundleJs,
      bundleCss: bundleCss,
      cspNonce: randomHash,
      csp: csp,
      preload: collectModulePreloads(
        `${env.OUTPUT_FOLDER}/${bundleJs}`,
        buildResult.metafile.outputs,
      )
        .map((x) => `<link rel="modulepreload" href="/${x}" as="script" />`)
        .join('\n'),
      livereloadScript: hotReload
        ? `<script src="http://localhost:35729/livereload.js" nonce="${randomHash}"></script>`
        : '',
      ...config.define,
    },
  });

  if (env.WATCH) {
    log('Build finished, watching for changes');
    notify('Build finished, watching for changes');
    await serve();
  } else {
    log('Build finished');
    notify('Build finished');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/*
  Utils
 */

function collectModulePreloads(entry, outputs) {
  function traverse(next) {
    const imports = outputs[next]?.imports ?? [];
    const staticImports = imports.filter(({ kind }) => kind === 'import-statement');
    return [next, ...staticImports.flatMap(({ path }) => traverse(path, outputs))];
  }
  return uniq(traverse(entry)).map((x) => path.relative(env.OUTPUT_FOLDER, x));
}
