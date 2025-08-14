import {
  Stack,
  StackProps,
  aws_codepipeline as codepipline,
  aws_codepipeline_actions as codepipline_actions,
} from 'aws-cdk-lib'
import { Construct } from 'constructs'
import { DeployConfig } from '../tarpon/lib/configs/config-deployment'
import { createVpcLogGroup } from '../tarpon/infra/cdk-utils/cdk-log-group-utils'
import { RetentionDays } from 'aws-cdk-lib/aws-logs'
import { buildTarpon } from './utils/tarpon-build-stage'
import { getSentryReleaseSpec } from './utils/sentry-release-spec'
import { getVpc } from './utils/vpc'
import {
  E2E_ARTIFACT,
  SOURCE_ARTIFACT,
  TARPON_BUILD_ARTIFACT,
} from './constants/artifcats'
import { tarponDeployStage } from './utils/tarpon-deploy-stage'
import { config as devConfig } from '@flagright/lib/config/config-dev'
import { config as phytoDevConfig } from '../phytoplankton-console/lib/configs/config-dev'
import { config as phytoSandboxConfig } from '../phytoplankton-console/lib/configs/config-sandbox'
import { config as phytoProdConfig } from '../phytoplankton-console/lib/configs/config-prod'
import { getCodeDeployRole } from './utils/code-deploy-role'
import { phytoplanktonDeployStage } from './utils/phytoplankton-console-deploy'
import { getE2ETestProject } from './utils/e2e_test_stage'
import { postDeploymentCodeBuildProject } from './utils/post_deploy_tarpon'
import {
  PRODUCTION_REGIONS,
  SANDBOX_REGIONS,
} from '@flagright/lib/constants/deploy'
import { BudgetServiceTypes, createBudget } from '@flagright/lib/cdk-utils'
import {
  postProdDeployIntegrationsUpdateBuildProject,
  postSandboxDeployIntegrationsUpdateBuildProject,
} from './utils/integrations-update'
import { getTarponConfig } from '@flagright/lib/constants/config'
const PIPLINE_NAME = 'orca-pipeline'

function getCodeBuildActionName(actionName: string, region: string) {
  return `${actionName}_${region.toUpperCase().replace('-', '_')}`
}

export type CdkOrcaPipelineStackProps = StackProps

export class CdkOrcaPipelineStack extends Stack {
  constructor(
    scope: Construct,
    id: string,
    props: CdkOrcaPipelineStackProps,
    deployConfig: DeployConfig
  ) {
    super(scope, id, props)

    const vpc = getVpc(this)

    createVpcLogGroup(this, vpc, {
      name: 'codebuild-orca',
      logRetention: RetentionDays.ONE_WEEK,
    })

    const role = getCodeDeployRole(this, deployConfig)
    const DEV_CODE_DEPLOY_ROLE_ARN = `arn:aws:iam::${phytoDevConfig.env.account}:role/CodePipelineDeployRole`
    const SANDBOX_CODE_DEPLOY_ROLE_ARN = `arn:aws:iam::${phytoSandboxConfig.env.account}:role/CodePipelineDeployRole`
    const PROD_CODE_DEPLOY_ROLE_ARN = `arn:aws:iam::${phytoProdConfig.env.account}:role/CodePipelineDeployRole`

    // CodePipeline

    const budgetConfigs: Record<
      keyof DeployConfig['budget'],
      BudgetServiceTypes[]
    > = {
      CODEBUILD: ['CodeBuild'],
      EC2: [
        'Amazon Elastic Compute Cloud - Compute',
        'EC2 - Other',
        'Amazon EC2 Container Registry (ECR)',
      ],
      CODEPIPELINE: ['AWS CodePipeline'],
    }

    Object.entries(budgetConfigs).forEach(([key, value]) => {
      createBudget(this, {
        budgetName: `${deployConfig.env.account}-${key}-${deployConfig.env.region}`,
        budgetAmount: deployConfig.budget[key],
        budgetServiceType: value,
        region: deployConfig.env.region as string,
      })
    })

    new codepipline.Pipeline(this, PIPLINE_NAME, {
      pipelineName: PIPLINE_NAME,
      stages: [
        {
          stageName: 'Source',
          actions: [
            new codepipline_actions.CodeStarConnectionsSourceAction({
              actionName: 'GitHub_Source',
              repo: deployConfig.github.REPO,
              connectionArn: deployConfig.github.GITHUB_CONNECTION_ARN,
              output: SOURCE_ARTIFACT,
              owner: deployConfig.github.OWNER,
              variablesNamespace: 'SourceVariables',
              triggerOnPush: false,
              branch: deployConfig.github.BRANCH,
              codeBuildCloneOutput: true,
            }),
          ],
        },
        {
          stageName: 'Build',
          actions: [
            new codepipline_actions.CodeBuildAction({
              actionName: 'Build',
              input: SOURCE_ARTIFACT,
              project: buildTarpon(this, role),
              outputs: [TARPON_BUILD_ARTIFACT],
              environmentVariables: getSentryReleaseSpec(true).actionEnv,
            }),
          ],
        },
        {
          stageName: 'Deploy_Dev',
          actions: [
            new codepipline_actions.CodeBuildAction({
              actionName: 'Deploy_Tarpon',
              input: SOURCE_ARTIFACT,
              project: tarponDeployStage(this, devConfig, role, vpc),
              extraInputs: [TARPON_BUILD_ARTIFACT],
              environmentVariables: getSentryReleaseSpec(true).actionEnv,
            }),
            new codepipline_actions.CodeBuildAction({
              actionName: 'Deploy_Phytoplankton_Console',
              input: SOURCE_ARTIFACT,
              project: phytoplanktonDeployStage(
                this,
                'dev',
                DEV_CODE_DEPLOY_ROLE_ARN,
                role
              ),
            }),
          ],
        },
        {
          stageName: 'Post_Deploy_Dev',
          actions: [
            new codepipline_actions.CodeBuildAction({
              actionName: 'Post_Deploy_Dev',
              project: postDeploymentCodeBuildProject(
                this,
                devConfig,
                role,
                vpc
              ),
              input: SOURCE_ARTIFACT,
              environmentVariables: getSentryReleaseSpec(true).actionEnv,
              extraInputs: [TARPON_BUILD_ARTIFACT],
            }),
          ],
        },
        {
          stageName: 'Start_E2E_Test',
          actions: [
            new codepipline_actions.ManualApprovalAction({
              actionName: 'Start_E2E_Test',
              externalEntityLink: `https://${phytoDevConfig.SITE_DOMAIN}`,
            }),
          ],
        },
        {
          stageName: 'E2E_Test_Dev',

          actions: [
            new codepipline_actions.CodeBuildAction({
              actionName: 'E2E_Test_Dev',
              project: getE2ETestProject(this, 'dev', role, devConfig, vpc),
              input: SOURCE_ARTIFACT,
              outputs: [E2E_ARTIFACT],
              extraInputs: [TARPON_BUILD_ARTIFACT],
            }),
          ],
        },
        {
          stageName: 'Approve_Sandbox',
          actions: [
            new codepipline_actions.ManualApprovalAction({
              actionName: 'Approve_Sandbox',
              externalEntityLink: `https://${phytoDevConfig.SITE_DOMAIN}`,
            }),
          ],
        },
        {
          stageName: 'Deploy_Sandbox',
          actions: [
            ...SANDBOX_REGIONS.flatMap((region) => {
              const config = getTarponConfig('sandbox', region)
              const actions = [
                new codepipline_actions.CodeBuildAction({
                  actionName: getCodeBuildActionName('Deploy_Tarpon', region),
                  project: tarponDeployStage(this, config, role, vpc),
                  input: SOURCE_ARTIFACT,
                  extraInputs: [TARPON_BUILD_ARTIFACT],
                  environmentVariables: getSentryReleaseSpec(false).actionEnv,
                }),
              ]
              return actions
            }),
            new codepipline_actions.CodeBuildAction({
              actionName: 'Deploy_Phytoplankton_Console',
              project: phytoplanktonDeployStage(
                this,
                'sandbox',
                SANDBOX_CODE_DEPLOY_ROLE_ARN,
                role
              ),
              input: SOURCE_ARTIFACT,
            }),
          ],
        },
        {
          stageName: 'Post_Deploy_Sandbox',
          actions: [
            ...SANDBOX_REGIONS.map((region) => {
              return new codepipline_actions.CodeBuildAction({
                actionName: getCodeBuildActionName(
                  'Post_Deploy_Sandbox',
                  region
                ),
                project: postDeploymentCodeBuildProject(
                  this,
                  getTarponConfig('sandbox', region),
                  role,
                  vpc
                ),
                input: SOURCE_ARTIFACT,
                environmentVariables: getSentryReleaseSpec(false).actionEnv,
                extraInputs: [TARPON_BUILD_ARTIFACT],
              })
            }),
            new codepipline_actions.CodeBuildAction({
              actionName: 'Integrations_Update',
              project: postSandboxDeployIntegrationsUpdateBuildProject(
                this,
                role
              ),
              input: SOURCE_ARTIFACT,
              environmentVariables: getSentryReleaseSpec(false).actionEnv,
              extraInputs: [TARPON_BUILD_ARTIFACT],
              runOrder: 2,
            }),
          ],
        },
        {
          stageName: 'Approve_Production',
          actions: [
            new codepipline_actions.ManualApprovalAction({
              actionName: 'Approve_Production',
              externalEntityLink: `https://${phytoSandboxConfig.SITE_DOMAIN}`,
            }),
          ],
        },
        {
          stageName: 'Deploy_Prod',
          actions: [
            ...PRODUCTION_REGIONS.flatMap((region) => {
              const config = getTarponConfig('prod', region)
              const actions = [
                new codepipline_actions.CodeBuildAction({
                  actionName: getCodeBuildActionName('Deploy_Tarpon', region),
                  project: tarponDeployStage(this, config, role, vpc),
                  input: SOURCE_ARTIFACT,
                  extraInputs: [TARPON_BUILD_ARTIFACT],
                  environmentVariables: getSentryReleaseSpec(false).actionEnv,
                }),
              ]
              return actions
            }),
            new codepipline_actions.CodeBuildAction({
              actionName: 'Deploy_Phytoplankton_Console',
              project: phytoplanktonDeployStage(
                this,
                'prod',
                PROD_CODE_DEPLOY_ROLE_ARN,
                role
              ),
              input: SOURCE_ARTIFACT,
            }),
          ],
        },
        {
          stageName: 'Post_Deploy_Prod',
          actions: [
            new codepipline_actions.CodeBuildAction({
              actionName: 'Integrations_Update',
              project: postProdDeployIntegrationsUpdateBuildProject(this, role),
              input: SOURCE_ARTIFACT,
              environmentVariables: getSentryReleaseSpec(false).actionEnv,
              extraInputs: [TARPON_BUILD_ARTIFACT],
            }),
            ...PRODUCTION_REGIONS.map((region) => {
              return new codepipline_actions.CodeBuildAction({
                actionName: getCodeBuildActionName('Post_Deploy_Prod', region),
                project: postDeploymentCodeBuildProject(
                  this,
                  getTarponConfig('prod', region),
                  role,
                  vpc
                ),
                input: SOURCE_ARTIFACT,
                environmentVariables: getSentryReleaseSpec(false).actionEnv,
                extraInputs: [TARPON_BUILD_ARTIFACT],
              })
            }),
          ],
        },
      ],
    })
  }
}
