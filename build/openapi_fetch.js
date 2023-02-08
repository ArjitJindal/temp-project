#!/usr/bin/env node
/* eslint-disable */
const https = require('https'); // or 'https' for https:// URLs
const fs = require('fs-extra');
const path = require('path');
const { sys } = require('typescript');
require('dotenv').config();

const OUTPUT_FILE_PATH = path.resolve(__dirname, '..', 'config', 'openapi.yaml');
const LOCAL_OPENAPI_PATH = path.resolve(
  __dirname,
  '..',
  '..',
  'tarpon',
  'dist',
  'openapi',
  'internal',
  'openapi-internal-original.yaml',
);

const BRANCH = (process.env.STOPLIGHT_BRANCH ?? process.env.BRANCH ?? 'main').replace(/\//g, '-');
const ACCOUNT = process.env.STOPLIGHT_ACCOUNT || `flagright-internal`;
const PROJECT = process.env.STOPLIGHT_PROJECT || `flagright-internal-api`;
const FILE_NAME = process.env.STOPLIGHT_FILE_NAME || `openapi-internal-original.yaml`;

async function main() {
  if (process.env.ENV === 'local') {
    if (!fs.existsSync(LOCAL_OPENAPI_PATH)) {
      console.error(
        `${LOCAL_OPENAPI_PATH} doesn't exist. Run "npm run openapi:prepare" in tarpon first.`,
      );
      sys.exit(1);
    }
    fs.copyFileSync(LOCAL_OPENAPI_PATH, OUTPUT_FILE_PATH);
    return;
  }

  console.log(`BRANCH: ${BRANCH}`);
  console.log(`ACCOUNT: ${ACCOUNT}`);
  console.log(`PROJECT: ${PROJECT}`);

  const schema = await fetchSchema({
    branch: BRANCH,
    stoplightAccount: ACCOUNT,
    stoplightProject: PROJECT,
    stoplightFileName: FILE_NAME,
  });
  await fs.writeFile(OUTPUT_FILE_PATH, schema);
  console.log('Download finished');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

async function download(url, queryParams) {
  const query = Object.entries(queryParams)
    .filter(([_, value]) => !!value)
    .map((pair) => pair.join('='))
    .join('&');

  // https://stoplight.io/api/v1/projects/koluch/flagright-internal-test/nodes/openapi-internal-original.yaml?branch=nikolai-FDT-85434_stoplight&deref=optimizedBundle
  const fullUrl = url + (query ? `?${query}` : '');
  console.log(`Full url for download: ${fullUrl}`);
  return new Promise((resolve, reject) => {
    const request = https.get(fullUrl, function (response) {
      try {
        if (response.statusCode !== 200) {
          throw new Error(`Bad response status: ${response.statusCode}. URL used: ${url}`);
        }
        let result = '';
        response.on('data', function (chunk) {
          result += chunk;
        });

        // after download completed close filestream
        response.on('end', () => {
          resolve(result);
        });
      } catch (e) {
        reject(e);
      }
    });

    // check for request error too
    request.on('error', (err) => {
      reject(err);
    });
  });
}

async function fetchSchema({ branch, stoplightAccount, stoplightProject, stoplightFileName }) {
  const url = `https://stoplight.io/api/v1/projects/${stoplightAccount}/${stoplightProject}/nodes/${stoplightFileName}`;
  return await download(url, {
    branch: branch,
    // deref: 'optimizedBundle',
  });
}
