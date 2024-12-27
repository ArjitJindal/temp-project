import { Construct } from 'constructs'
import {
  aws_codebuild as codebuild,
  aws_iam as iam,
  aws_ec2 as ec2,
  Duration,
} from 'aws-cdk-lib'
import { Config } from '@flagright/lib/config/config'
import { getAssumeRoleCommands } from './assume-role-commands'
import { GENERATED_DIRS } from '../constants/generatedDirs'
import { TARPON_BUILD_ARTIFACT } from '../constants/artifcats'
import { getSentryReleaseSpec } from './sentry-release-spec'
import { installTerraform } from '../constants/terraform-commands'
import { ComputeType } from 'aws-cdk-lib/aws-codebuild'

export const tarponDeployStage = (
  scope: Construct,
  config: Config,
  role: iam.IRole,
  vpc: ec2.IVpc
) => {
  const env = config.stage + (config.region ? `:${config.region}` : '')
  const shouldReleaseSentry = config.stage === 'sandbox'

  return new codebuild.PipelineProject(scope, `TarponDeploy-${env}`, {
    buildSpec: codebuild.BuildSpec.fromObject({
      version: '0.2',
      phases: {
        install: {
          'runtime-versions': {
            nodejs: 18,
          },
          commands: [
            'corepack enable && yarn set version 4.0.2',
            'yarn install --immutable',
            'cd tarpon',
            'corepack enable',
            'yarn add @tsconfig/node18@18.2.1 ts-node@10.9.1 typescript@5.2.2',
            `export ENV=${env}`,
            `export AWS_REGION=${config.env.region}`,
            `export AWS_ACCOUNT=${config.env.account}`,
            ...getAssumeRoleCommands(config),
            'cd ..',
          ],
        },
        build: {
          commands: [
            'cd tarpon',
            ...GENERATED_DIRS.map(
              (dir) =>
                `mv "$CODEBUILD_SRC_DIR_${TARPON_BUILD_ARTIFACT.artifactName}"/${dir} ${dir}`
            ),
            ...(shouldReleaseSentry
              ? getSentryReleaseSpec(false).commands
              : []),
            'corepack enable',
            `yarn run migration:pre:up`,
            // Don't upload source maps to Lambda
            'rm dist/lambdas/**/*.js.map',
            ...installTerraform,
            `yarn run synth:${env}`,
            `yarn run deploy:${env}`,
            ...(config.region === 'eu-1'
              ? [
                  'yarn add -g nango',
                  'cd ../nango-integrations',
                  'yarn install',
                  'npm run generate',
                  `npm run deploy:${config.stage}`,
                ]
              : []),
          ],
        },
      },
      artifacts: {
        'base-directory': 'tarpon/cdk.out',
        files: ['*.json'],
      },
      env: shouldReleaseSentry ? getSentryReleaseSpec(false).env : undefined,
    }),
    environment: {
      buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2_5,
      computeType: ComputeType.LARGE,
      privileged: true,
    },
    role,
    timeout: Duration.hours(8),
    vpc,
  })
}
