import * as cdk from 'aws-cdk-lib'
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline'
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as codebuild from 'aws-cdk-lib/aws-codebuild'

import { Construct } from 'constructs'
import { ComputeType } from 'aws-cdk-lib/aws-codebuild'
import { Duration } from 'aws-cdk-lib'
import { config as deployConfig } from './configs/config-deployment'
import { config as devConfig } from './configs/config-dev'
import { config as sandboxConfig } from './configs/config-sandbox'
import { config as prodAisa1Config } from './configs/config-prod-asia-1'
import { config as prodAisa2Config } from './configs/config-prod-asia-2'
import { config as prodEU1Config } from './configs/config-prod-eu-1'
import { config as prodUS1Config } from './configs/config-prod-us-1'
import { Config } from './configs/config'

const PIPELINE_NAME = 'tarpon-pipeline'
const GENERATED_DIRS = [
  'dist',
  'node_modules',
  'src/@types/openapi-internal',
  'src/@types/openapi-public',
]

export type CdkTarponPipelineStackProps = cdk.StackProps
export class CdkTarponPipelineStack extends cdk.Stack {
  constructor(
    scope: Construct,
    id: string,
    props: CdkTarponPipelineStackProps
  ) {
    super(scope, id, props)

    // NOTE: These deployment roles in the different accounts need to be created manually once with
    // enough priviledges to run `cdk deploy` for the target account.
    const devCodeDeployRole = iam.Role.fromRoleArn(
      this,
      'DevCodePipelineDeployRole',
      `arn:aws:iam::${devConfig.env.account}:role/CodePipelineDeployRole`,
      {
        mutable: false,
      }
    )

    // Build definition
    const buildProject = new codebuild.PipelineProject(this, 'TarponBuild', {
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          install: {
            'runtime-versions': {
              nodejs: 16,
            },
            commands: ['npm ci'],
          },
          build: {
            commands: ['npm run build'],
          },
        },
        cache: {
          paths: ['node_modules/**/*'],
        },
        artifacts: {
          'base-directory': '.',
          files: GENERATED_DIRS.map((dir) => `${dir}/**/*`),
        },
      }),
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_6_0,
        computeType: ComputeType.MEDIUM,
      },
    })
    const getDeployCodeBuildProject = (config: Config) => {
      const env = config.stage + (config.region ? `:${config.region}` : '')
      const roleArn = `arn:aws:iam::${config.env.account}:role/CodePipelineDeployRole`
      return new codebuild.PipelineProject(this, `TarponDeploy-${env}`, {
        buildSpec: codebuild.BuildSpec.fromObject({
          version: '0.2',
          phases: {
            install: {
              'runtime-versions': {
                nodejs: 16,
              },
              commands: [
                'npm install @tsconfig/node16 ts-node typescript',
                `ASSUME_ROLE_ARN="${roleArn}"`,
                `TEMP_ROLE=$(aws sts assume-role --role-arn $ASSUME_ROLE_ARN --role-session-name deploy)`,
                'export TEMP_ROLE',
                'export AWS_ACCESS_KEY_ID=$(echo "${TEMP_ROLE}" | jq -r ".Credentials.AccessKeyId")',
                'export AWS_SECRET_ACCESS_KEY=$(echo "${TEMP_ROLE}" | jq -r ".Credentials.SecretAccessKey")',
                'export AWS_SESSION_TOKEN=$(echo "${TEMP_ROLE}" | jq -r ".Credentials.SessionToken")',
                `export SM_SECRET_ARN=${config.application.ATLAS_CREDENTIALS_SECRET_ARN}`,
                `export ENV=${env}`,
                `export AWS_REGION=${config.env.region}`,
              ],
            },
            build: {
              commands: [
                ...GENERATED_DIRS.map(
                  (dir) =>
                    `mv "$CODEBUILD_SRC_DIR_${buildOutput.artifactName}"/${dir} ${dir}`
                ),
                `npm run migration:pre:up`,
                `npm run synth:${env}`,
                `npm run deploy:${env} -- --require-approval=never`,
                `npm run migration:post:up`,
              ],
            },
          },
          artifacts: {
            'base-directory': 'cdk.out',
            files: ['*.json'],
          },
        }),
        environment: {
          buildImage: codebuild.LinuxBuildImage.STANDARD_6_0,
        },
        role: devCodeDeployRole,
        // Max timeout: 480 minutes (https://docs.aws.amazon.com/codebuild/latest/userguide/limits.html)
        timeout: Duration.hours(8),
      })
    }

    // Define pipeline stage output artifacts
    const sourceOutput = new codepipeline.Artifact()
    const buildOutput = new codepipeline.Artifact('BuildOutput')

    // Pipeline definition
    new codepipeline.Pipeline(this, PIPELINE_NAME, {
      pipelineName: PIPELINE_NAME,
      stages: [
        {
          stageName: 'Source',
          actions: [
            new codepipeline_actions.CodeStarConnectionsSourceAction({
              actionName: 'GitHub_Source',
              repo: deployConfig.github.REPO,
              owner: deployConfig.github.OWNER,
              branch: deployConfig.github.BRANCH,
              output: sourceOutput,
              connectionArn: deployConfig.github.GITHUB_CONNECTION_ARN,
            }),
          ],
        },
        {
          stageName: 'Build',
          actions: [
            new codepipeline_actions.CodeBuildAction({
              actionName: 'Build',
              project: buildProject,
              input: sourceOutput,
              outputs: [buildOutput],
            }),
          ],
        },
        {
          stageName: 'Deploy-Dev',
          actions: [
            new codepipeline_actions.CodeBuildAction({
              actionName: 'Deploy',
              project: getDeployCodeBuildProject(devConfig),
              input: sourceOutput,
              extraInputs: [buildOutput],
            }),
          ],
        },
        {
          stageName: 'Deploy-Sandbox',
          actions: [
            new codepipeline_actions.CodeBuildAction({
              actionName: 'Deploy',
              project: getDeployCodeBuildProject(sandboxConfig),
              input: sourceOutput,
              extraInputs: [buildOutput],
            }),
          ],
        },
        {
          stageName: 'Approve',
          actions: [
            new codepipeline_actions.ManualApprovalAction({
              actionName: 'Approve',
              externalEntityLink: sandboxConfig.application.CONSOLE_URI,
            }),
          ],
        },
        {
          stageName: 'Deploy-Prod',
          actions: [
            new codepipeline_actions.CodeBuildAction({
              actionName: 'Deploy_asia-1',
              project: getDeployCodeBuildProject(prodAisa1Config),
              input: sourceOutput,
              extraInputs: [buildOutput],
            }),
            new codepipeline_actions.CodeBuildAction({
              actionName: 'Deploy_asia-2',
              project: getDeployCodeBuildProject(prodAisa2Config),
              input: sourceOutput,
              extraInputs: [buildOutput],
            }),
            new codepipeline_actions.CodeBuildAction({
              actionName: 'Deploy_eu-1',
              project: getDeployCodeBuildProject(prodEU1Config),
              input: sourceOutput,
              extraInputs: [buildOutput],
            }),
            new codepipeline_actions.CodeBuildAction({
              actionName: 'Deploy_us-1',
              project: getDeployCodeBuildProject(prodUS1Config),
              input: sourceOutput,
              extraInputs: [buildOutput],
            }),
          ],
        },
      ],
    })
  }
}
