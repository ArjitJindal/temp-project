import * as cdk from 'aws-cdk-lib'
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline'
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as codebuild from 'aws-cdk-lib/aws-codebuild'

import { Construct } from 'constructs'
import { ComputeType } from 'aws-cdk-lib/aws-codebuild'
import { config as deployConfig } from './configs/config-deployment'
import { config as devConfig } from './configs/config-dev'
import { config as sandboxConfig } from './configs/config-sandbox'
import { config as prodConfig } from './configs/config-prod-asia-1'

const PIPELINE_NAME = 'tarpon-pipeline'

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
    const DEV_CODE_DEPLOY_ROLE_ARN = `arn:aws:iam::${devConfig.env.account}:role/CodePipelineDeployRole`
    const devCodeDeployRole = iam.Role.fromRoleArn(
      this,
      'DevCodePipelineDeployRole',
      DEV_CODE_DEPLOY_ROLE_ARN,
      {
        mutable: false,
      }
    )
    const SANDBOX_CODE_DEPLOY_ROLE_ARN = `arn:aws:iam::${sandboxConfig.env.account}:role/CodePipelineDeployRole`
    const PROD_CODE_DEPLOY_ROLE_ARN = `arn:aws:iam::${prodConfig.env.account}:role/CodePipelineDeployRole`

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
          'base-directory': 'dist',
          files: ['**/*'],
        },
      }),
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_5_0,
        computeType: ComputeType.MEDIUM,
      },
    })
    const getDeployCodeBuildProject = (
      env: 'dev' | 'sandbox' | 'prod:asia-1' | 'prod:asia-2' | 'prod:eu-1',
      roleArn: string
    ) =>
      new codebuild.PipelineProject(this, `TarponDeploy-${env}`, {
        buildSpec: codebuild.BuildSpec.fromObject({
          version: '0.2',
          phases: {
            install: {
              'runtime-versions': {
                nodejs: 16,
              },
              commands: [
                'npm install -g aws-cdk',
                'npm install @tsconfig/node16 ts-node typescript',
                `ASSUME_ROLE_ARN="${roleArn}"`,
                `TEMP_ROLE=$(aws sts assume-role --role-arn $ASSUME_ROLE_ARN --role-session-name deploy)`,
                'export TEMP_ROLE',
                'export AWS_ACCESS_KEY_ID=$(echo "${TEMP_ROLE}" | jq -r ".Credentials.AccessKeyId")',
                'export AWS_SECRET_ACCESS_KEY=$(echo "${TEMP_ROLE}" | jq -r ".Credentials.SecretAccessKey")',
                'export AWS_SESSION_TOKEN=$(echo "${TEMP_ROLE}" | jq -r ".Credentials.SessionToken")',
              ],
            },
            build: {
              commands: [
                `cp -r $CODEBUILD_SRC_DIR_${buildOutput.artifactName} dist`,
                `npm run synth:${env}`,
                `npm run deploy:${env} -- --require-approval=never`,
              ],
            },
          },
          artifacts: {
            'base-directory': 'cdk.out',
            files: ['*.json'],
          },
        }),
        environment: {
          buildImage: codebuild.LinuxBuildImage.STANDARD_5_0,
        },
        role: devCodeDeployRole,
      })

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
              project: getDeployCodeBuildProject(
                'dev',
                DEV_CODE_DEPLOY_ROLE_ARN
              ),
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
              project: getDeployCodeBuildProject(
                'sandbox',
                SANDBOX_CODE_DEPLOY_ROLE_ARN
              ),
              input: sourceOutput,
              extraInputs: [buildOutput],
              runOrder: 1,
            }),
          ],
        },
        {
          stageName: 'Deploy-Prod',
          actions: [
            new codepipeline_actions.ManualApprovalAction({
              actionName: 'Approve',
              externalEntityLink: sandboxConfig.application.CONSOLE_URI,
              runOrder: 1,
            }),
            new codepipeline_actions.CodeBuildAction({
              actionName: 'Deploy_asia-1',
              project: getDeployCodeBuildProject(
                'prod:asia-1',
                PROD_CODE_DEPLOY_ROLE_ARN
              ),
              input: sourceOutput,
              extraInputs: [buildOutput],
              runOrder: 2,
            }),
            new codepipeline_actions.CodeBuildAction({
              actionName: 'Deploy_asia-2',
              project: getDeployCodeBuildProject(
                'prod:asia-2',
                PROD_CODE_DEPLOY_ROLE_ARN
              ),
              input: sourceOutput,
              extraInputs: [buildOutput],
              runOrder: 2,
            }),
            new codepipeline_actions.CodeBuildAction({
              actionName: 'Deploy_eu-1',
              project: getDeployCodeBuildProject(
                'prod:eu-1',
                PROD_CODE_DEPLOY_ROLE_ARN
              ),
              input: sourceOutput,
              extraInputs: [buildOutput],
              runOrder: 2,
            }),
          ],
        },
      ],
    })
  }
}
