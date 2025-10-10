import { Construct } from 'constructs'
import { aws_codebuild as codebuild, aws_iam as iam } from 'aws-cdk-lib'
import { STACK_CONSTANTS } from '../constants/stack-constants'

export const phytoplanktonDeployStage = (
  scope: Construct,
  env: 'dev' | 'sandbox' | 'prod',
  roleArn: string,
  codeDeployRole: iam.IRole
) => {
  return new codebuild.PipelineProject(scope, `PhytoplanktonBuild-${env}`, {
    buildSpec: codebuild.BuildSpec.fromObject({
      version: '0.2',
      phases: {
        install: {
          'runtime-versions': {
            nodejs: 20,
          },
          commands: [
            'corepack enable && yarn set version 4.0.2',
            'npm install -g nango@0.61.1',
            'yarn install --immutable',
            'yarn add @tsconfig/node20@20.1.5 ts-node@10.9.1 typescript@5.2.2',
            'cd phytoplankton-console',
            'npm install -g aws-cdk yarn',
            'corepack enable && yarn set version 4.0.2',
            'yarn install --immutable',
            `ASSUME_ROLE_ARN="${roleArn}"`,
            `TEMP_ROLE=$(aws sts assume-role --role-arn $ASSUME_ROLE_ARN --role-session-name deploy)`,
            'export TEMP_ROLE',
            'export AWS_ACCESS_KEY_ID=$(echo "${TEMP_ROLE}" | jq -r ".Credentials.AccessKeyId")',
            'export AWS_SECRET_ACCESS_KEY=$(echo "${TEMP_ROLE}" | jq -r ".Credentials.SecretAccessKey")',
            'export AWS_SESSION_TOKEN=$(echo "${TEMP_ROLE}" | jq -r ".Credentials.SessionToken")',
            'cd ..',
          ],
        },
        build: {
          commands: [
            'cd phytoplankton-console',
            `SENTRY_UPLOAD=true npm run build:${env}`,
            `npm run synth:${env}`,
            `npm run deploy:${env} -- --require-approval=never`,
          ],
        },
      },
      cache: {
        paths: ['node_modules/**/*'],
      },
      env: {
        'secrets-manager': {
          SENTRY_AUTH_TOKEN: STACK_CONSTANTS.SENTRY_AUTH_TOKEN,
        },
      },
    }),
    environment: {
      buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
    },
    role: codeDeployRole,
  })
}
