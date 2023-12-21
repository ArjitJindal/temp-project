import { STACK_CONSTANTS } from '../constants/stack-constants'
import { getReleaseVersionTarpon } from './release-version'
import { BuildEnvironmentVariableType } from 'aws-cdk-lib/aws-codebuild'

export const getSentryReleaseSpec = (production: boolean) => {
  return {
    commands: [
      production
        ? undefined
        : `./node_modules/.bin/sentry-cli releases files ${getReleaseVersionTarpon(
            'latest-version'
          )} delete --all`,
      `./node_modules/.bin/sentry-cli releases set-commits $RELEASE_VERSION --commit flagright/tarpon@$RELEASE_COMMIT`,
      `./node_modules/.bin/sentry-cli releases files $RELEASE_VERSION upload-sourcemaps --ext js --ext map --ignore-file .sentryignore dist`,
      `./node_modules/.bin/sentry-cli releases finalize $RELEASE_VERSION`,
    ].filter(Boolean) as string[],
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
          production ? '#{SourceVariables.CommitId}' : 'latest-version'
        ),
      },
      RELEASE_COMMIT: {
        type: BuildEnvironmentVariableType.PLAINTEXT,
        value: '#{SourceVariables.CommitId}',
      },
    },
  }
}
