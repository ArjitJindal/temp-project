import { Construct } from 'constructs'
<<<<<<< HEAD
import { Config } from '@flagright/lib/config/config'
=======
import { Config } from '../../tarpon/lib/configs/config'
>>>>>>> dd64d2331 (Spread assume role commands)
import { aws_codebuild as codebuild, aws_iam as iam } from 'aws-cdk-lib'
import { getAssumeRoleCommands } from './assume-role-commands'

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
              nodejs: 18,
            },
            commands: [
              'cd databricks',
              'npm install',
              ...getAssumeRoleCommands(config),
              'cd ..',
            ],
          },
          build: {
            commands: [
              'cd databricks',
              `npm run deploy -- ${config.stage} ${config.region} --auto-approve`,
            ],
          },
        },
        cache: {
          paths: ['node_modules/**/*'],
        },
      }),
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
      },
      role: codeDeployRole,
    }
  )
}
