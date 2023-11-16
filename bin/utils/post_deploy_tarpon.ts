import { Config } from "../../tarpon/lib/configs/config";
import {
  aws_codebuild as codebuild,
  aws_iam as iam,
  Duration,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import { getAssumeRoleCommands } from "./assume-role-commands";
import { GENERATED_DIRS } from "../constants/generatedDirs";
import { tarponBuildOutput } from "../constants/artifcats";
import { ComputeType } from "aws-cdk-lib/aws-codebuild";
import { IVpc } from "aws-cdk-lib/aws-ec2";

export const postDeploymentCodeBuildProject = (
  scope: Construct,
  config: Config,
  codeDeployRole: iam.IRole,
  vpc: IVpc
) => {
  const env = config.stage + (config.region ? `:${config.region}` : "");
  return new codebuild.PipelineProject(scope, `TarponPostDeployment-${env}`, {
    buildSpec: codebuild.BuildSpec.fromObject({
      version: "0.2",
      phases: {
        install: {
          "runtime-versions": {
            nodejs: 18,
          },
          commands: [
            "npm ci",
            "npm install @tsconfig/node18@18.2.1 ts-node@10.9.1 typescript@5.2.2",
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
            `npm run migration:post:up`,
            "cd ..",
          ],
        },
        ...(["dev", "sandbox"].includes(config.stage)
          ? {
              post_build: {
                commands: [
                  "cd tarpon",
                  `export ENV=${env}`,
                  `export AWS_REGION=${config.env.region}`,
                  ...getAssumeRoleCommands(config),
                  `npm run postman:integration:${config.stage}`,
                  `npm run test:public:${config.stage}`,
                ],
              },
            }
          : {}),
      },
    }),

    environment: {
      buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
      computeType: ComputeType.LARGE,
    },
    role: codeDeployRole,
    // Max timeout: 480 minutes (https://docs.aws.amazon.com/codebuild/latest/userguide/limits.html)
    timeout: Duration.hours(8),
    vpc,
  });
};
