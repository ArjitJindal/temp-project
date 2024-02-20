import { STACK_CONSTANTS } from '../constants/stack-constants'
import { getReleaseVersionTarpon } from './release-version'
import { BuildEnvironmentVariableType } from 'aws-cdk-lib/aws-codebuild'
import { compact } from 'lodash'

export const getSentryReleaseSpec = (isDev: boolean) => {
  return {
    commands: compact<string>([
      `./node_modules/.bin/sentry-cli releases set-commits $RELEASE_VERSION --commit flagright/orca@$RELEASE_COMMIT`,
      `./node_modules/.bin/sentry-cli releases finalize $RELEASE_VERSION`,
      `./node_modules/.bin/sentry-cli sourcemaps inject dist`,
      `./node_modules/.bin/sentry-cli sourcemaps upload --release=$RELEASE_VERSION --ext js --ext map --ignore-file .sentryignore dist`,
    ]),
    env: {
      'secrets-manager': {
        SENTRY_AUTH_TOKEN: STACK_CONSTANTS.SENTRY_AUTH_TOKEN,
      },
      variables: {
        SENTRY_ORG: 'flagright-data-technologies-in',
        SENTRY_PROJECT: 'tarpon',
      },
    },
    actionEnv: {
      RELEASE_VERSION: {
        type: BuildEnvironmentVariableType.PLAINTEXT,
        value: getReleaseVersionTarpon(
          isDev ? 'latest-version' : '#{SourceVariables.CommitId}'
        ),
      },
      RELEASE_COMMIT: {
        type: BuildEnvironmentVariableType.PLAINTEXT,
        value: '#{SourceVariables.CommitId}',
      },
    },
  }
}
