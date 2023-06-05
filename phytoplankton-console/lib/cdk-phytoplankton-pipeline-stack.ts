import * as cdk from 'aws-cdk-lib';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as iam from 'aws-cdk-lib/aws-iam';

import { Construct } from 'constructs';
import { config as deployConfig } from './configs/config-deployment';
import { config as devConfig } from './configs/config-dev';
import { config as sandboxConfig } from './configs/config-sandbox';
import { config as prodConfig } from './configs/config-prod';

const PIPELINE_NAME = 'phytoplankton-pipeline';

export class CdkPhytoplanktonPipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);

    // NOTE: These deployment roles in the different accounts need to be created manually once with
    // enough priviledges to run `cdk deploy` for the target account.
    const DEV_CODE_DEPLOY_ROLE_ARN = `arn:aws:iam::${devConfig.env.account}:role/CodePipelineDeployRole`;
    const SANDBOX_CODE_DEPLOY_ROLE_ARN = `arn:aws:iam::${sandboxConfig.env.account}:role/CodePipelineDeployRole`;
    const PROD_CODE_DEPLOY_ROLE_ARN = `arn:aws:iam::${prodConfig.env.account}:role/CodePipelineDeployRole`;
    const codeDeployRole = iam.Role.fromRoleArn(
      this,
      'DeployCodePipelineDeployRole',
      `arn:aws:iam::${deployConfig.env.account}:role/CodePipelineDeployRole`,
      {
        mutable: false,
      },
    );

    // Build definition
    const getDeployCodeBuildProject = (env: 'dev' | 'sandbox' | 'prod', roleArn: string) =>
      new codebuild.PipelineProject(this, `PhytoplanktonBuild-${env}`, {
        buildSpec: codebuild.BuildSpec.fromObject({
          version: '0.2',
          phases: {
            install: {
              'runtime-versions': {
                nodejs: 16,
              },
              commands: [
                'cd phytoplankton-console',
                'npm install -g aws-cdk yarn',
                'yarn --ignore-engines',
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
              SENTRY_AUTH_TOKEN:
                'arn:aws:secretsmanager:eu-central-1:073830519512:secret:sentryCreds-NQB0S7:authToken',
            },
          },
        }),
        environment: {
          buildImage: codebuild.LinuxBuildImage.STANDARD_6_0,
        },
        role: codeDeployRole,
      });

    const getE2ETestProject = (env: 'dev') =>
      new codebuild.PipelineProject(this, `PhytoplanktonE2eTest-${env}`, {
        buildSpec: codebuild.BuildSpec.fromObject({
          version: '0.2',
          phases: {
            install: {
              'runtime-versions': {
                nodejs: 16,
              },
              commands: [
                'cd phytoplankton-console',
                'apt-get update',
                'apt-get -y install libgtk2.0-0 libgtk-3-0 libgbm-dev libnotify-dev libgconf-2-4 libnss3 libxss1 libasound2 libxtst6 xauth xvfb',
                'npm install -g aws-cdk yarn',
                'yarn --ignore-engines',
              ],
            },
            build: {
              commands: ['npm run cypress:test:dev'],
            },
          },
          cache: {
            paths: ['node_modules/**/*'],
          },
          env: {
            'secrets-manager': {
              cypress_username:
                'arn:aws:secretsmanager:eu-central-1:073830519512:secret:cypressCreds-yNKjtZ:username',
              cypress_password:
                'arn:aws:secretsmanager:eu-central-1:073830519512:secret:cypressCreds-yNKjtZ:password',
            },
          },
        }),
        environment: {
          buildImage: codebuild.LinuxBuildImage.STANDARD_6_0,
        },
        role: codeDeployRole,
      });

    // Define pipeline stage output artifacts
    const sourceOutput = new codepipeline.Artifact();

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
          stageName: 'Deploy_Dev',
          actions: [
            new codepipeline_actions.CodeBuildAction({
              actionName: 'Deploy',
              project: getDeployCodeBuildProject('dev', DEV_CODE_DEPLOY_ROLE_ARN),
              input: sourceOutput,
            }),
          ],
        },
        {
          stageName: 'E2E_Test_Dev',
          actions: [
            new codepipeline_actions.CodeBuildAction({
              actionName: 'E2E_Test_Dev',
              project: getE2ETestProject('dev'),
              input: sourceOutput,
            }),
          ],
        },
        {
          stageName: 'Deploy_Sandbox',
          actions: [
            new codepipeline_actions.CodeBuildAction({
              actionName: 'Deploy',
              project: getDeployCodeBuildProject('sandbox', SANDBOX_CODE_DEPLOY_ROLE_ARN),
              input: sourceOutput,
            }),
          ],
        },
        {
          stageName: 'Approve',
          actions: [
            new codepipeline_actions.ManualApprovalAction({
              actionName: 'Approve',
              externalEntityLink: `https://${sandboxConfig.SITE_DOMAIN}`,
            }),
          ],
        },
        {
          stageName: 'Deploy_Prod',
          actions: [
            new codepipeline_actions.CodeBuildAction({
              actionName: 'Deploy',
              project: getDeployCodeBuildProject('prod', PROD_CODE_DEPLOY_ROLE_ARN),
              input: sourceOutput,
            }),
          ],
        },
      ],
    });
  }
}
