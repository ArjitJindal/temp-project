import {
  aws_codebuild as codebuild,
  aws_iam as iam,
  aws_ec2 as ec2,
} from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { STACK_CONSTANTS } from '../constants/stack-constants'
import { commandMoveGeneratedDirs } from '../constants/generatedDirs'
import { Config } from '@flagright/lib/config/config'
import { getAssumeRoleCommands } from './assume-role-commands'

export const getE2ETestProject = (
  scope: Construct,
  env: 'dev',
  codeDeployRole: iam.IRole,
  config: Config,
  vpc: ec2.IVpc
) => {
  return new codebuild.PipelineProject(scope, `PhytoplanktonE2eTest-${env}`, {
    buildSpec: codebuild.BuildSpec.fromObject({
      version: '0.2',
      phases: {
        install: {
          'runtime-versions': {
            nodejs: 20,
          },
          commands: [
            'corepack enable && yarn set version 4.0.2',
            'yarn install --immutable',
            'yarn add @tsconfig/node20@20.1.5 ts-node@10.9.1 typescript@5.2.2',
            'cd tarpon',
            'yarn add @tsconfig/node20@20.1.5 ts-node@10.9.1 typescript@5.2.2',
            'cd ..',
            'cd phytoplankton-console',
            'apt-get update',
            'apt-get -y install libgtk2.0-0 libgtk-3-0 libgbm-dev libnotify-dev libgconf-2-4 libnss3 libxss1 libasound2 libxtst6 xauth xvfb',
            'npm install -g aws-cdk yarn',
            'corepack enable',
            'yarn --frozen-lockfile',
            `export AWS_REGION=${config.env.region}`,
            `export AWS_ACCOUNT=${config.env.account}`,
            `export ENV=${config.stage}`,
            ...getAssumeRoleCommands(config),
            `cd ..`,
          ],
        },
        build: {
          commands: [
            'cd tarpon',
            'export SEED_TRANSACTIONS_COUNT=1000',
            ...commandMoveGeneratedDirs(),
            'npm run migration:seed:demo-data',
            'cd ..',
            'cd phytoplankton-console',
            'ENV=dev CI=true npm run cypress:run',
          ],
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
          SLACK_TOKEN: STACK_CONSTANTS.SLACK_TOKEN,
        },
      },
    }),
    environment: {
      buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
      computeType: codebuild.ComputeType.MEDIUM,
    },
    role: codeDeployRole,
    vpc,
  })
}
