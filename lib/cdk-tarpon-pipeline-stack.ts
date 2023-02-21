import * as cdk from 'aws-cdk-lib'
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline'
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as codebuild from 'aws-cdk-lib/aws-codebuild'

import { Construct } from 'constructs'
import {
  BuildEnvironmentVariableType,
  ComputeType,
} from 'aws-cdk-lib/aws-codebuild'
import { Duration } from 'aws-cdk-lib'
import { SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2'
import { config as devConfig } from './configs/config-dev'
import { config as sandboxConfig } from './configs/config-sandbox'
import { config as prodAisa1Config } from './configs/config-prod-asia-1'
import { config as prodAisa2Config } from './configs/config-prod-asia-2'
import { config as prodEU1Config } from './configs/config-prod-eu-1'
import { config as prodEU2Config } from './configs/config-prod-eu-2'
import { config as prodUS1Config } from './configs/config-prod-us-1'
import { Config } from './configs/config'
import { DeployConfig } from './configs/config-deployment'

const PIPELINE_NAME = 'tarpon-pipeline'
const GENERATED_DIRS = [
  'dist',
  'node_modules',
  'src/@types/openapi-internal',
  'src/@types/openapi-internal-custom',
  'src/@types/openapi-public',
  'src/@types/openapi-public-custom',
  'src/@types/openapi-public-management',
  'src/@types/openapi-public-management-custom',
  'src/@types/openapi-public-device-data',
  'src/@types/openapi-public-device-data-custom',
  '.gen',
]

function getReleaseVersion(version: string) {
  return `tarpon:${version}`
}

export type CdkTarponPipelineStackProps = cdk.StackProps
export class CdkTarponPipelineStack extends cdk.Stack {
  constructor(
    scope: Construct,
    id: string,
    props: CdkTarponPipelineStackProps,
    deployConfig: DeployConfig
  ) {
    super(scope, id, props)

    // NOTE: These deployment roles in the different accounts need to be created manually once with
    // enough priviledges to run `cdk deploy` for the target account.
    const codeDeployRole = iam.Role.fromRoleArn(
      this,
      'DeployCodePipelineDeployRole',
      `arn:aws:iam::${deployConfig.env.account}:role/CodePipelineDeployRole`,
      {
        mutable: false,
      }
    )

    // Define pipeline stage output artifacts
    const sourceOutput = new codepipeline.Artifact()
    const buildOutput = new codepipeline.Artifact('BuildOutput')

    const getSentryReleaseSpec = (production: boolean) => {
      return {
        commands: [
          production
            ? undefined
            : `./node_modules/.bin/sentry-cli releases files ${getReleaseVersion(
                'latest-version'
              )} delete --all`,
          `./node_modules/.bin/sentry-cli releases set-commits $RELEASE_VERSION --commit flagright/tarpon@$RELEASE_COMMIT`,
          `./node_modules/.bin/sentry-cli releases files $RELEASE_VERSION upload-sourcemaps --ext js --ext map --ignore-file .sentryignore dist`,
          `./node_modules/.bin/sentry-cli releases finalize $RELEASE_VERSION`,
        ].filter(Boolean),
        env: {
          'secrets-manager': {
            SENTRY_AUTH_TOKEN:
              'arn:aws:secretsmanager:eu-central-1:073830519512:secret:sentryCreds-NQB0S7:authToken',
          },
          variables: {
            SENTRY_ORG: 'flagright-data-technologies-in',
            SENTRY_PROJECT: 'tarpon',
          },
        },
        actionEnv: {
          RELEASE_VERSION: {
            type: BuildEnvironmentVariableType.PLAINTEXT,
            value: getReleaseVersion(
              production ? '#{SourceVariables.CommitId}' : 'latest-version'
            ),
          },
          RELEASE_COMMIT: {
            type: BuildEnvironmentVariableType.PLAINTEXT,
            value: '#{SourceVariables.CommitId}',
          },
        },
      }
    }
    const devSandboxSentryReleaseSpec = getSentryReleaseSpec(false)
    const prodSentryReleaseSpec = getSentryReleaseSpec(true)

    const installTerraform = [
      'curl -s -qL -o terraform_install.zip https://releases.hashicorp.com/terraform/1.3.7/terraform_1.3.7_linux_amd64.zip',
      'unzip terraform_install.zip -d /usr/bin/',
      'chmod +x /usr/bin/terraform',
    ]

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
            commands: [
              ...installTerraform,
              'npm run build',
              ...devSandboxSentryReleaseSpec.commands,
            ],
          },
        },
        cache: {
          paths: ['node_modules/**/*'],
        },
        artifacts: {
          'base-directory': '.',
          files: GENERATED_DIRS.map((dir) => `${dir}/**/*`),
        },
        env: devSandboxSentryReleaseSpec.env,
      }),
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_6_0,
        computeType: ComputeType.LARGE,
      },
      role: codeDeployRole,
    })

    const vpc = new Vpc(this, 'vpc-codebuild', {
      subnetConfiguration: [
        {
          subnetType: SubnetType.PRIVATE_WITH_NAT,
          cidrMask: 24,
          name: 'PrivateSubnet1',
        },
        {
          subnetType: SubnetType.PUBLIC,
          cidrMask: 28,
          name: 'PublicSubnet1',
        },
      ],
    })
    const getDeployCodeBuildProject = (config: Config) => {
      const env = config.stage + (config.region ? `:${config.region}` : '')
      const assumeRuleCommands = [
        `ASSUME_ROLE_ARN="arn:aws:iam::${config.env.account}:role/CodePipelineDeployRole"`,
        `TEMP_ROLE=$(aws sts assume-role --role-arn $ASSUME_ROLE_ARN --role-session-name deploy-${config.region})`,
        'export TEMP_ROLE',
        'export AWS_ACCESS_KEY_ID=$(echo "${TEMP_ROLE}" | jq -r ".Credentials.AccessKeyId")',
        'export AWS_SECRET_ACCESS_KEY=$(echo "${TEMP_ROLE}" | jq -r ".Credentials.SecretAccessKey")',
        'export AWS_SESSION_TOKEN=$(echo "${TEMP_ROLE}" | jq -r ".Credentials.SessionToken")',
      ]
      const shouldReleaseSentry =
        config.stage === 'prod' && config.region === 'eu-1'
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
                `export SM_SECRET_ARN=${config.application.ATLAS_CREDENTIALS_SECRET_ARN}`,
                `export AUTH0_MANAGEMENT_CREDENTIALS_SECRET_ARN=${config.application.AUTH0_MANAGEMENT_CREDENTIALS_SECRET_ARN}`,
                `export ENV=${env}`,
                `export AWS_REGION=${config.env.region}`,
                ...assumeRuleCommands,
              ],
            },
            build: {
              commands: [
                ...GENERATED_DIRS.map(
                  (dir) =>
                    `mv "$CODEBUILD_SRC_DIR_${buildOutput.artifactName}"/${dir} ${dir}`
                ),
                ...(shouldReleaseSentry ? prodSentryReleaseSpec.commands : []),
                `npm run migration:pre:up`,
                ...assumeRuleCommands,
                // Don't upload source maps to Lambda
                'rm dist/**/*.js.map',
                ...installTerraform,
                `npm run synth:${env}`,
                `npm run deploy:${env}`,
                `npm run migration:post:up`,
              ],
            },
            ...(['dev', 'sandbox'].includes(config.stage)
              ? {
                  post_build: {
                    commands: [
                      `export AUTH0_MANAGEMENT_CREDENTIALS_SECRET_ARN=${config.application.AUTH0_MANAGEMENT_CREDENTIALS_SECRET_ARN}`,
                      `export ENV=${env}`,
                      `export AWS_REGION=${config.env.region}`,
                      ...assumeRuleCommands,
                      `npm run postman:integration:${config.stage}`,
                    ],
                  },
                }
              : {}),
          },
          artifacts: {
            'base-directory': 'cdk.out',
            files: ['*.json'],
          },
          env: shouldReleaseSentry ? prodSentryReleaseSpec.env : undefined,
        }),
        environment: {
          buildImage: codebuild.LinuxBuildImage.STANDARD_6_0,
          computeType: ComputeType.LARGE,
        },
        role: codeDeployRole,
        // Max timeout: 480 minutes (https://docs.aws.amazon.com/codebuild/latest/userguide/limits.html)
        timeout: Duration.hours(8),
        vpc,
      })
    }

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
              variablesNamespace: 'SourceVariables',
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
              environmentVariables: devSandboxSentryReleaseSpec.actionEnv,
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
              environmentVariables: devSandboxSentryReleaseSpec.actionEnv,
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
              environmentVariables: devSandboxSentryReleaseSpec.actionEnv,
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
              environmentVariables: prodSentryReleaseSpec.actionEnv,
            }),
            new codepipeline_actions.CodeBuildAction({
              actionName: 'Deploy_asia-2',
              project: getDeployCodeBuildProject(prodAisa2Config),
              input: sourceOutput,
              extraInputs: [buildOutput],
              environmentVariables: prodSentryReleaseSpec.actionEnv,
            }),
            new codepipeline_actions.CodeBuildAction({
              actionName: 'Deploy_eu-1',
              project: getDeployCodeBuildProject(prodEU1Config),
              input: sourceOutput,
              extraInputs: [buildOutput],
              environmentVariables: prodSentryReleaseSpec.actionEnv,
            }),
            new codepipeline_actions.CodeBuildAction({
              actionName: 'Deploy_eu-2',
              project: getDeployCodeBuildProject(prodEU2Config),
              input: sourceOutput,
              extraInputs: [buildOutput],
              environmentVariables: prodSentryReleaseSpec.actionEnv,
            }),
            new codepipeline_actions.CodeBuildAction({
              actionName: 'Deploy_us-1',
              project: getDeployCodeBuildProject(prodUS1Config),
              input: sourceOutput,
              extraInputs: [buildOutput],
              environmentVariables: prodSentryReleaseSpec.actionEnv,
            }),
          ],
        },
      ],
    })
  }
}
