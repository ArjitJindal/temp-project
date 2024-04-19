import { Construct } from 'constructs'
import { Config } from '@flagright/lib/config/config'
import { aws_codebuild as codebuild, aws_iam as iam } from 'aws-cdk-lib'
import { getAssumeRoleCommands } from './assume-role-commands'
import { installTerraform } from '../constants/terraform-commands'
import { ComputeType } from 'aws-cdk-lib/aws-codebuild'

export const databricksDeployStage = (
  scope: Construct,
  config: Config,
  codeDeployRole: iam.IRole
) => {
  return new codebuild.PipelineProject(
    scope,
    `DatabricksBuild-${config.stage}-${config.region}`,
    {
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          install: {
            'runtime-versions': {
              nodejs: 16,
              python: '3.10',
            },
            commands: [
              'export YARN_IGNORE_NODE=1',
              'corepack enable && yarn set version 4.0.2',
              'yarn install --immutable',
              'cd lib',
              'yarn install --immutable',
              'cd ../databricks/infra',
              'npm install',
              ...getAssumeRoleCommands(config),
              'cd ../..',
            ],
          },
          build: {
            commands: [
              ...installTerraform,
              'cd databricks',
              'make generate',
              'cd infra',
              'pip install poetry',
              `QUIET_MODE=1 npm run deploy -- ${config.stage} ${
                config.region || 'eu-1'
              } --auto-approve`,
            ],
          },
        },
        cache: {
          paths: ['node_modules/**/*'],
        },
      }),
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_6_0,
        computeType: ComputeType.LARGE,
      },
      role: codeDeployRole,
    }
  )
}
