/* eslint-disable @typescript-eslint/no-var-requires */
const { execSync } = require('child_process');
const fs = require('fs');
const detectPort = require('detect-port');
const prompts = require('prompts');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');
const { fromIni } = require('@aws-sdk/credential-providers');

const CYPRESS_CREDS_SECRET_ARN = 'rbacCypressCreds';

if (!process.env.ENV) {
  process.env.ENV = 'local';
}

async function getCypressCreds() {
  console.info('🔑 Getting Cypress credentials from AWS Secrets Manager...');
  try {
    const smClient = new SecretsManagerClient({
      region: 'eu-central-1',
      credentials: fromIni({
        profile: `AWSAdministratorAccess-911899431626`,
      }),
    });
    const secretString = (
      await smClient.send(
        new GetSecretValueCommand({
          SecretId: CYPRESS_CREDS_SECRET_ARN,
        }),
      )
    ).SecretString;
    const { super_admin, custom_role, admin } = JSON.parse(secretString);
    return {
      super_admin,
      custom_role,
      admin,
    };
  } catch (e) {
    console.error(
      `❗❗Please run 'npm run aws-login dev' to refresh the aws credentials for the Dev account!`,
    );
    throw e;
  }
}

(async () => {
  const cypressCreds = process.env.CYPRESS_CREDS ?? {};
  console.info('🔑 Cypress creds in env', cypressCreds);
  let { super_admin, custom_role, admin } =
    typeof cypressCreds === 'string' ? JSON.parse(cypressCreds) : cypressCreds;
  try {
    const cypressEnv = JSON.parse(fs.readFileSync('cypress.env.json'));
    super_admin = cypressEnv.super_admin;
    custom_role = cypressEnv.custom_role;
    admin = cypressEnv.admin;
  } catch (e) {
    // ignore
  }

  if (!super_admin && !custom_role && !admin) {
    const creds = await getCypressCreds();
    super_admin = creds.super_admin;
    custom_role = creds.custom_role;
    admin = creds.admin;
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
  const credentials = {
    super_admin: super_admin,
    custom_role: custom_role,
    admin: admin,
  };
  let ENV_VARS = [];
  Object.keys(credentials).map((key, index) => {
    ENV_VARS.push(`${key}_username=${credentials[key].username}`);
    ENV_VARS.push(`${key}_password=${credentials[key].password}`);
  });
  execSync(`./node_modules/.bin/cypress ${type} --env ${ENV_VARS.join(',')} ${headlessFlag}`, {
    stdio: 'inherit',
  });
})();
