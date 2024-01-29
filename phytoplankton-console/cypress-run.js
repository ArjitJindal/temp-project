/* eslint-disable @typescript-eslint/no-var-requires */
const { execSync } = require('child_process');
const fs = require('fs');
const detectPort = require('detect-port');
const prompts = require('prompts');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { fromIni } = require('@aws-sdk/credential-providers');

if (!process.env.ENV) {
  process.env.ENV = 'local';
}

const CYPRESS_CREDS_SECRET_ARN =
  'arn:aws:secretsmanager:eu-central-1:911899431626:secret:cypressCreds-BX1Tr2';

async function getCypressCreds() {
  console.info('🔑🔑🔑 Fetching Cypress credentials from AWS Secrets Manager...');
  try {
    const smClient = new SecretsManagerClient({
      region: 'eu-central-1',
      credentials: fromIni({
        profile: 'AWSAdministratorAccess-911899431626',
      }),
    });
    const secretString = (
      await smClient.send(
        new GetSecretValueCommand({
          SecretId: CYPRESS_CREDS_SECRET_ARN,
        }),
      )
    ).SecretString;
    const { username, password } = JSON.parse(secretString);
    return {
      username,
      password,
    };
  } catch (e) {
    console.error(
      `❗❗Please run 'npm run aws-login dev' to refresh the aws credentials for the Dev account!`,
    );
    throw e;
  }
}

(async () => {
  let username = process.env.CYPRESS_USERNAME;
  let password = process.env.CYPRESS_PASSWORD;
  try {
    const cypressEnv = JSON.parse(fs.readFileSync('cypress.env.json'));
    username = cypressEnv.username;
    password = cypressEnv.password;
  } catch (e) {
    // ignore
  }
  if (!username && !password) {
    const creds = await getCypressCreds();
    username = creds.username;
    password = creds.password;
  }
  const type = process.argv[2];
  const headlessFlag =
    type === 'run' ? (process.env.CI === 'true' ? '--headless' : '--headed') : '';

  if (process.env.ENV === 'local') {
    const isLocalConsoleRunning = (await detectPort(8001)) !== 8001;
    const isLocalTarponRunning = (await detectPort(3002)) !== 3002;
    if (!isLocalConsoleRunning) {
      console.error(`Please start local Console first (port 8001) ('yarn start:local')`);
      process.exit(1);
    }

    const consoleResponse = await prompts({
      type: 'confirm',
      name: 'value',
      initial: 'Y',
      message: `You'll use local Console to run the tests. Are you sure?`,
    });
    if (consoleResponse.value === false) {
      process.exit(1);
    }
    const apiMessage = isLocalTarponRunning
      ? `You'll use local API to run the tests. Did you run 'TENANT=cypress-tenant npm run dev:databases:init' in tarpon to seed the data for testing?`
      : `Your local Console API is not running. You'll use Dev API to run the tests. Are you sure?`;
    const apiResponse = await prompts({
      type: 'confirm',
      name: 'value',
      initial: 'Y',
      message: apiMessage,
    });
    if (apiResponse.value === false) {
      process.exit(1);
    }
  }

  execSync(
    `./node_modules/.bin/cypress ${type} --env username=${username},password=${password} ${headlessFlag}`,
    {
      stdio: 'inherit',
    },
  );
})();
