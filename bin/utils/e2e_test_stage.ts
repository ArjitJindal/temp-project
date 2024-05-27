import { aws_codebuild as codebuild, aws_iam as iam } from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { STACK_CONSTANTS } from '../constants/stack-constants'

export const getE2ETestProject = (
  scope: Construct,
  env: 'dev',
  codeDeployRole: iam.IRole
) => {
  return new codebuild.PipelineProject(scope, `PhytoplanktonE2eTest-${env}`, {
    buildSpec: codebuild.BuildSpec.fromObject({
      version: '0.2',
      phases: {
        install: {
          'runtime-versions': {
            nodejs: 18,
          },
          commands: [
            'cd phytoplankton-console',
            'apt-get update',
            'apt-get -y install libgtk2.0-0 libgtk-3-0 libgbm-dev libnotify-dev libgconf-2-4 libnss3 libxss1 libasound2 libxtst6 xauth xvfb',
            'npm install -g aws-cdk yarn',
            'corepack enable',
            'yarn --frozen-lockfile',
          ],
        },
        build: {
          commands: ['ENV=dev CI=true npm run cypress:run'],
        },
      },
      cache: {
        paths: ['node_modules/**/*'],
      },
      artifacts: {
        'base-directory': 'phytoplankton-console/cypress',
        files: [
          'videos/**/*',
          'screenshots/**/*',
          // NOTE: This is a workaround to have at least one file in the artifacts to prevent the
          // "no matching artifact paths found" error
          'tsconfig.json',
        ],
      },
      env: {
        'secrets-manager': {
          CYPRESS_CREDS: STACK_CONSTANTS.CYPRESS_CREDS,
        },
      },
    }),
    environment: {
      buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
      computeType: codebuild.ComputeType.MEDIUM,
    },
    role: codeDeployRole,
  })
}
