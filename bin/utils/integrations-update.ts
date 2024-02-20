import { aws_codebuild as codebuild, aws_iam as iam } from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { STACK_CONSTANTS } from '../constants/stack-constants'

export const integrationsUpdateBuildProject = (
  scope: Construct,
  codeDeployRole: iam.IRole
) => {
  return new codebuild.PipelineProject(scope, `TarponIntegrationsUpdate`, {
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
          ],
        },
        build: {
          commands: ['./node_modules/.bin/ts-node scripts/create-release.ts'],
        },
      },
      env: {
        'secrets-manager': {
          NOTION_TOKEN: STACK_CONSTANTS.NOTION_TOKEN,
          GITHUB_TOKEN: STACK_CONSTANTS.GITHUB_TOKEN,
          SLACK_TOKEN: STACK_CONSTANTS.SLACK_TOKEN,
        },
      },
    }),

    environment: {
      buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
    },
    role: codeDeployRole,
  })
}
