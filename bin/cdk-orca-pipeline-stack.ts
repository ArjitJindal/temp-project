import {
  Stack,
  StackProps,
  aws_codepipeline as codepipline,
  aws_codepipeline_actions as codepipline_actions,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import { DeployConfig } from "../tarpon/lib/configs/config-deployment";
import { createVpcLogGroup } from "../tarpon/infra/cdk-utils/cdk-log-group-utils";
import { RetentionDays } from "aws-cdk-lib/aws-logs";
import { buildTarpon } from "./utils/tarpon-build-stage";
import { getSentryReleaseSpec } from "./utils/sentry-release-spec";
import { getVpc } from "./utils/vpc";
import { sourceOutput, tarponBuildOutput } from "./constants/artifcats";
import { tarponDeployStage } from "./utils/tarpon-deploy-stage";
import { config as devConfig } from "../tarpon/lib/configs/config-dev";
import { config as sandboxConfig } from "../tarpon/lib/configs/config-sandbox";
import { config as prodConfigAsia1 } from "../tarpon/lib/configs/config-prod-asia-1";
import { config as prodConfigAsia2 } from "../tarpon/lib/configs/config-prod-asia-2";
import { config as prodConfigEu1 } from "../tarpon/lib/configs/config-prod-eu-1";
import { config as prodConfigEu2 } from "../tarpon/lib/configs/config-prod-eu-2";
import { config as prodConfigUs1 } from "../tarpon/lib/configs/config-prod-us-1";
import { config as prodConfigAu1 } from "../tarpon/lib/configs/config-prod-au-1";
import { getCodeDeployRole } from "./utils/code-deploy-role";
import { phytoplanktonDeployStage } from "./utils/phytoplankton-console-deploy";
import { config as phytoDevConfig } from "../phytoplankton-console/lib/configs/config-dev";
import { config as phytoSandboxConfig } from "../phytoplankton-console/lib/configs/config-sandbox";
import { config as phytoProdConfig } from "../phytoplankton-console/lib/configs/config-prod";
import { getE2ETestProject } from "./utils/e2e_test_stage";
import { postDeploymentCodeBuildProject } from "./utils/post_deploy_tarpon";

const PIPLINE_NAME = "orca-pipeline";

export type CdkOrcaPipelineStackProps = StackProps;

export class CdkOrcaPipelineStack extends Stack {
  constructor(
    scope: Construct,
    id: string,
    props: CdkOrcaPipelineStackProps,
    deployConfig: DeployConfig
  ) {
    super(scope, id, props);

    const vpc = getVpc(this);

    createVpcLogGroup(this, vpc, {
      name: "codebuild",
      logRetention: RetentionDays.TWO_MONTHS,
    });

    const role = getCodeDeployRole(this, deployConfig);
    const DEV_CODE_DEPLOY_ROLE_ARN = `arn:aws:iam::${phytoDevConfig.env.account}:role/CodePipelineDeployRole`;
    const SANDBOX_CODE_DEPLOY_ROLE_ARN = `arn:aws:iam::${phytoSandboxConfig.env.account}:role/CodePipelineDeployRole`;
    const PROD_CODE_DEPLOY_ROLE_ARN = `arn:aws:iam::${phytoProdConfig.env.account}:role/CodePipelineDeployRole`;

    // CodePipeline

    new codepipline.Pipeline(this, PIPLINE_NAME, {
      pipelineName: PIPLINE_NAME,
      stages: [
        {
          stageName: "Source",
          actions: [
            new codepipline_actions.CodeStarConnectionsSourceAction({
              actionName: "GitHub_Source",
              repo: deployConfig.github.REPO,
              connectionArn: deployConfig.github.GITHUB_CONNECTION_ARN,
              output: sourceOutput,
              owner: deployConfig.github.OWNER,
              variablesNamespace: "SourceVariables",
              triggerOnPush: false,
              branch: deployConfig.github.BRANCH,
              codeBuildCloneOutput: true,
            }),
          ],
        },
        {
          stageName: "Build",
          actions: [
            new codepipline_actions.CodeBuildAction({
              actionName: "Build",
              input: sourceOutput,
              project: buildTarpon(this, role),
              outputs: [tarponBuildOutput],
              environmentVariables: getSentryReleaseSpec(false).actionEnv,
            }),
          ],
        },
        {
          stageName: "Deploy_Dev",
          actions: [
            new codepipline_actions.CodeBuildAction({
              actionName: "Deploy_Tarpon",
              input: sourceOutput,
              project: tarponDeployStage(this, devConfig, role, vpc),
              extraInputs: [tarponBuildOutput],
              environmentVariables: getSentryReleaseSpec(false).actionEnv,
            }),
            new codepipline_actions.CodeBuildAction({
              actionName: "Deploy_Phytoplankton_Console",
              input: sourceOutput,
              project: phytoplanktonDeployStage(
                this,
                "dev",
                DEV_CODE_DEPLOY_ROLE_ARN,
                role
              ),
            }),
          ],
        },
        {
          stageName: "Post_Deploy_Dev",
          actions: [
            new codepipline_actions.CodeBuildAction({
              actionName: "Post_Deploy_Dev",
              project: postDeploymentCodeBuildProject(
                this,
                devConfig,
                role,
                vpc
              ),
              input: sourceOutput,
              environmentVariables: getSentryReleaseSpec(false).actionEnv,
              extraInputs: [tarponBuildOutput],
            }),
          ],
        },
        {
          stageName: "E2E_Test_Dev",
          actions: [
            new codepipline_actions.CodeBuildAction({
              actionName: "E2E_Test_Dev",
              project: getE2ETestProject(this, "dev", role),
              input: sourceOutput,
            }),
          ],
        },
        {
          stageName: "Approve_Sandbox",
          actions: [
            new codepipline_actions.ManualApprovalAction({
              actionName: "Approve_Sandbox",
              externalEntityLink: `https://${phytoDevConfig.SITE_DOMAIN}`,
            }),
          ],
        },
        {
          stageName: "Deploy_Sandbox",
          actions: [
            new codepipline_actions.CodeBuildAction({
              actionName: "Deploy_Tarpon",
              project: tarponDeployStage(this, sandboxConfig, role, vpc),
              input: sourceOutput,
              extraInputs: [tarponBuildOutput],
              environmentVariables: getSentryReleaseSpec(false).actionEnv,
            }),
            new codepipline_actions.CodeBuildAction({
              actionName: "Deploy_Phytoplankton_Console",
              project: phytoplanktonDeployStage(
                this,
                "sandbox",
                SANDBOX_CODE_DEPLOY_ROLE_ARN,
                role
              ),
              input: sourceOutput,
            }),
          ],
        },
        {
          stageName: "Approve_Production",
          actions: [
            new codepipline_actions.ManualApprovalAction({
              actionName: "Approve_Production",
              externalEntityLink: `https://${phytoSandboxConfig.SITE_DOMAIN}`,
            }),
          ],
        },
        {
          stageName: "Deploy_Prod",
          actions: [
            new codepipline_actions.CodeBuildAction({
              actionName: "Deploy_Tarpon_EU_1",
              project: tarponDeployStage(this, prodConfigEu1, role, vpc),
              input: sourceOutput,
              extraInputs: [tarponBuildOutput],
              environmentVariables: getSentryReleaseSpec(false).actionEnv,
            }),
            new codepipline_actions.CodeBuildAction({
              actionName: "Deploy_Tarpon_EU_2",
              project: tarponDeployStage(this, prodConfigEu2, role, vpc),
              input: sourceOutput,
              extraInputs: [tarponBuildOutput],
              environmentVariables: getSentryReleaseSpec(false).actionEnv,
            }),
            new codepipline_actions.CodeBuildAction({
              actionName: "Deploy_Tarpon_US_1",
              project: tarponDeployStage(this, prodConfigUs1, role, vpc),
              input: sourceOutput,
              extraInputs: [tarponBuildOutput],
              environmentVariables: getSentryReleaseSpec(false).actionEnv,
            }),
            new codepipline_actions.CodeBuildAction({
              actionName: "Deploy_Tarpon_AU_1",
              project: tarponDeployStage(this, prodConfigAu1, role, vpc),
              input: sourceOutput,
              extraInputs: [tarponBuildOutput],
              environmentVariables: getSentryReleaseSpec(false).actionEnv,
            }),
            new codepipline_actions.CodeBuildAction({
              actionName: "Deploy_Tarpon_ASIA_1",
              project: tarponDeployStage(this, prodConfigAsia1, role, vpc),
              input: sourceOutput,
              extraInputs: [tarponBuildOutput],
              environmentVariables: getSentryReleaseSpec(false).actionEnv,
            }),
            new codepipline_actions.CodeBuildAction({
              actionName: "Deploy_Tarpon_ASIA_2",
              project: tarponDeployStage(this, prodConfigAsia2, role, vpc),
              input: sourceOutput,
              extraInputs: [tarponBuildOutput],
              environmentVariables: getSentryReleaseSpec(false).actionEnv,
            }),
            new codepipline_actions.CodeBuildAction({
              actionName: "Deploy_Phytoplankton_Console",
              project: phytoplanktonDeployStage(
                this,
                "prod",
                PROD_CODE_DEPLOY_ROLE_ARN,
                role
              ),
              input: sourceOutput,
            }),
          ],
        },
        {
          stageName: "Post_Deploy_Prod",
          actions: [
            new codepipline_actions.CodeBuildAction({
              actionName: "Post_Deploy_Prod_EU_1",
              project: postDeploymentCodeBuildProject(
                this,
                prodConfigEu1,
                role,
                vpc
              ),
              input: sourceOutput,
              environmentVariables: getSentryReleaseSpec(false).actionEnv,
              extraInputs: [tarponBuildOutput],
            }),
            new codepipline_actions.CodeBuildAction({
              actionName: "Post_Deploy_Prod_EU_2",
              project: postDeploymentCodeBuildProject(
                this,
                prodConfigEu2,
                role,
                vpc
              ),
              input: sourceOutput,
              environmentVariables: getSentryReleaseSpec(false).actionEnv,
              extraInputs: [tarponBuildOutput],
            }),
            new codepipline_actions.CodeBuildAction({
              actionName: "Post_Deploy_Prod_US_1",
              project: postDeploymentCodeBuildProject(
                this,
                prodConfigUs1,
                role,
                vpc
              ),
              input: sourceOutput,
              environmentVariables: getSentryReleaseSpec(false).actionEnv,
              extraInputs: [tarponBuildOutput],
            }),
            new codepipline_actions.CodeBuildAction({
              actionName: "Post_Deploy_Prod_AU_1",
              project: postDeploymentCodeBuildProject(
                this,
                prodConfigAu1,
                role,
                vpc
              ),
              input: sourceOutput,
              environmentVariables: getSentryReleaseSpec(false).actionEnv,
              extraInputs: [tarponBuildOutput],
            }),
            new codepipline_actions.CodeBuildAction({
              actionName: "Post_Deploy_Prod_ASIA_1",
              project: postDeploymentCodeBuildProject(
                this,
                prodConfigAsia1,
                role,
                vpc
              ),
              input: sourceOutput,
              environmentVariables: getSentryReleaseSpec(false).actionEnv,
              extraInputs: [tarponBuildOutput],
            }),
            new codepipline_actions.CodeBuildAction({
              actionName: "Post_Deploy_Prod_ASIA_2",
              project: postDeploymentCodeBuildProject(
                this,
                prodConfigAsia2,
                role,
                vpc
              ),
              input: sourceOutput,
              environmentVariables: getSentryReleaseSpec(false).actionEnv,
              extraInputs: [tarponBuildOutput],
            }),
          ],
        },
      ],
    });
  }
}
