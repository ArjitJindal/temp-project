import { Construct } from "constructs";
import {
  aws_codebuild as codebuild,
  aws_iam as iam,
  aws_ec2 as ec2,
  Duration,
} from "aws-cdk-lib";
import { Config } from "../../tarpon/lib/configs/config";
import { getAssumeRoleCommands } from "./assume-role-commands";
import { GENERATED_DIRS } from "../constants/generatedDirs";
import { tarponBuildOutput } from "../constants/artifcats";
import { getSentryReleaseSpec } from "./sentry-release-spec";
import { installTerraform } from "../constants/terraform-commands";
import { ComputeType } from "aws-cdk-lib/aws-codebuild";

export const tarponDeployStage = (
  scope: Construct,
  config: Config,
  role: iam.IRole,
  vpc: ec2.IVpc
) => {
  const env = config.stage + (config.region ? `:${config.region}` : "");
  const shouldReleaseSentry =
    config.stage === "prod" && config.region === "eu-1";

  return new codebuild.PipelineProject(scope, `TarponDeploy-${env}`, {
    buildSpec: codebuild.BuildSpec.fromObject({
      version: "0.2",
      phases: {
        install: {
          "runtime-versions": {
            nodejs: 18,
          },
          commands: [
            "npm ci",
            "cd tarpon",
            "npm install @tsconfig/node18@18.2.1 ts-node@10.9.1 typescript@5.2.2",
            `export ATLAS_CREDENTIALS_SECRET_ARN=${config.application.ATLAS_CREDENTIALS_SECRET_ARN}`,
            `export ENV=${env}`,
            `export AWS_REGION=${config.env.region}`,
            `export AWS_ACCOUNT=${config.env.account}`,
            ...getAssumeRoleCommands(config),
            "cd ..",
          ],
        },
        build: {
          commands: [
            "cd tarpon",
            ...GENERATED_DIRS.map(
              (dir) =>
                `mv "$CODEBUILD_SRC_DIR_${tarponBuildOutput.artifactName}"/${dir} ${dir}`
            ),
            ...(shouldReleaseSentry ? getSentryReleaseSpec(true).commands : []),
            `npm run migration:pre:up`,
            // Don't upload source maps to Lambda
            "rm dist/lambdas/**/*.js.map",
            ...installTerraform,
            `npm run synth:${env}`,
            `npm run deploy:${env}`,
          ],
        },
      },
      artifacts: {
        "base-directory": "tarpon/cdk.out",
        files: ["*.json"],
      },
      env: shouldReleaseSentry ? getSentryReleaseSpec(true).env : undefined,
    }),
    environment: {
      buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
      computeType: ComputeType.LARGE,
    },
    role,
    timeout: Duration.hours(8),
    vpc,
  });
};
