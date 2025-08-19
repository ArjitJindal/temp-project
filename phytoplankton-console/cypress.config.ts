import * as fs from 'fs';
import { defineConfig } from 'cypress';

let baseUrl: string;

if (process.env.ENV === 'local') {
  baseUrl = 'https://flagright.local:8001/';
} else if (process.env.ENV === 'dev') {
  baseUrl = 'https://console.flagright.dev/';
} else if (process.env.ENV?.startsWith('qa')) {
  baseUrl = `https://${process.env.ENV}.console.flagright.dev/`;
} else {
  throw new Error('Unknown environment');
}

export default defineConfig({
  numTestsKeptInMemory: 3,
  env: {
    environment: process.env.ENV ?? 'local',
    loginUrl: 'https://login.console.flagright.dev/',
    auth0_domain: 'dev-flagright.eu.auth0.com',
    local_auth0_client_id: 'uGGbVNumU7d57NswPLD5UaTwvf17tc7y',
    dev_auth0_client_id: 'uUFYLezaTSqQjj9052jiInDAaarI3f92',
    auth0_audience: 'https://api.flagright.dev/',
  },
  e2e: {
    defaultCommandTimeout: 15000,
    baseUrl,
    video: true,
    setupNodeEvents(on) {
      // Ref: https://docs.cypress.io/guides/guides/screenshots-and-videos#Delete-videos-for-specs-without-failing-or-retried-tests
      on('after:spec', (spec, results) => {
        if (results && results.video) {
          // Do we have failures for any retry attempts?
          const failures = results.tests.some((test) =>
            test.attempts.some((attempt) => attempt.state === 'failed'),
          );
          if (!failures) {
            // delete the video if the spec passed and no tests retried
            try {
              fs.unlinkSync(results.video);
            } catch (error) {
              console.error('Error deleting video:', error);
            }
          }
        }
      });

      on(
        'after:run',
        (
          results: CypressCommandLine.CypressRunResult | CypressCommandLine.CypressFailedRunResult,
        ) => {
          // we accumulate all the failed tests for all the runs
          // NOTE: we have a retry for each test, so we need to accumulate the failed attempts
          if (results.status === 'finished') {
            let failedTests: Record<string, number> = results?.runs?.reduce((globalAcc, run) => {
              return run.tests.reduce((acc, test) => {
                const testName = test.title.join('-');
                const failedAttempts = test.attempts.filter(
                  (attempt) => attempt.state === 'failed',
                );
                if (failedAttempts.length > 0) {
                  if (!acc[testName]) {
                    acc[testName] = 0;
                  }
                  acc[testName] += failedAttempts.length;
                }
                return acc;
              }, globalAcc);
            }, {});
            failedTests = Object.fromEntries(
              Object.entries(failedTests).sort(([, a], [, b]) => b - a),
            );
            // writing the failed tests to a file
            fs.writeFileSync(
              './cypress/failed-e2e-tests.json',
              JSON.stringify(failedTests, null, 2),
            );
          }
        },
      );
    },
  },
  chromeWebSecurity: false,
  retries: {
    runMode: 1,
    openMode: 0,
  },
});
