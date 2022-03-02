import * as cdk from 'aws-cdk-lib';
import { CfnCapabilities } from 'aws-cdk-lib';
import * as kms from 'aws-cdk-lib/aws-kms';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';

import { Construct } from 'constructs';
import { config as deployConfig } from './configs/config-deployment';
import { config as devConfig } from './configs/config-dev';
import { config as sandboxConfig } from './configs/config-sandbox';
import { CdkPhytoplanktonStack } from './cdk-phytoplankton-stack';

const PIPELINE_NAME = 'phytoplankton-pipeline';

export interface CdkPhytoplanktonPipelineStackProps extends cdk.StackProps {
  readonly devStack: CdkPhytoplanktonStack;
  readonly sandboxStack: CdkPhytoplanktonStack;
}

export class CdkPhytoplanktonPipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CdkPhytoplanktonPipelineStackProps) {
    super(scope, id, props);

    // Resolve ARNs of cross-account roles for the Dev account
    const devCloudFormationRole = iam.Role.fromRoleArn(
      this,
      'DevDeploymentRole',
      `arn:aws:iam::${devConfig.env.account}:role/CloudFormationDeploymentRole`,
      {
        mutable: false,
      },
    );
    const devCodeDeployRole = iam.Role.fromRoleArn(
      this,
      'DevCrossAccountRole',
      `arn:aws:iam::${devConfig.env.account}:role/CodePipelineCrossAccountRole`,
      {
        mutable: false,
      },
    );

    // Resolve ARNS of cross-account roles for the Sandbox account
    const sandboxCloudFormationRole = iam.Role.fromRoleArn(
      this,
      'ProdDeploymentRole',
      `arn:aws:iam::${sandboxConfig.env.account}:role/CloudFormationDeploymentRole`,
      {
        mutable: false,
      },
    );
    const sandboxCodeDeployRole = iam.Role.fromRoleArn(
      this,
      'ProdCrossAccountRole',
      `arn:aws:iam::${sandboxConfig.env.account}:role/CodePipelineCrossAccountRole`,
      {
        mutable: false,
      },
    );

    const key = kms.Key.fromKeyArn(
      this,
      'ArtifactKey',
      cdk.Fn.importValue('ArtifactBucketEncryptionKey'),
    );

    const artifactBucket = s3.Bucket.fromBucketAttributes(this, 'ArtifactBucket', {
      bucketArn: cdk.Fn.importValue('ArtifactBucket'),
      encryptionKey: key,
    });

    // CDK build definition
    const cdkBuild = new codebuild.PipelineProject(this, 'PhytoplanktonCdkBuild', {
      buildSpec: codebuild.BuildSpec.fromObject({
        version: '0.2',
        phases: {
          install: {
            'runtime-versions': {
              nodejs: 14,
            },
            commands: ['npm install', 'npm install -g aws-cdk'],
          },
          build: {
            commands: ['npm run build', 'npm run synth'],
          },
        },
        artifacts: {
          'base-directory': 'cdk.out',
          files: ['*phytoplankton.template.json'],
        },
      }),
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_5_0,
      },
      // use the encryption key for build artifacts
      encryptionKey: key,
    });

    // Define pipeline stage output artifacts
    const sourceOutput = new codepipeline.Artifact();
    const cdkBuildOutput = new codepipeline.Artifact('CdkBuildOutput');

    // Pipeline definition
    const pipeline = new codepipeline.Pipeline(this, PIPELINE_NAME, {
      pipelineName: PIPELINE_NAME,
      artifactBucket: artifactBucket,
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
              actionName: 'CDK_Synth',
              project: cdkBuild,
              input: sourceOutput,
              outputs: [cdkBuildOutput],
            }),
          ],
        },
        {
          stageName: 'Deploy_Dev',
          actions: [
            new codepipeline_actions.CloudFormationCreateUpdateStackAction({
              actionName: 'Deploy',
              templatePath: cdkBuildOutput.atPath('dev-phytoplankton.template.json'),
              stackName: 'DevPhytoplanktonDeploymentStack',
              adminPermissions: true,
              cfnCapabilities: [CfnCapabilities.ANONYMOUS_IAM],
              role: devCodeDeployRole,
              deploymentRole: devCloudFormationRole,
            }),
          ],
        },
        {
          stageName: 'Deploy_Sandbox',
          actions: [
            new codepipeline_actions.ManualApprovalAction({
              actionName: 'Approve',
            }),
            new codepipeline_actions.CloudFormationCreateUpdateStackAction({
              actionName: 'Deploy',
              templatePath: cdkBuildOutput.atPath('sandbox-phytoplankton.template.json'),
              stackName: 'SandboxPhytoplanktonDeploymentStack',
              adminPermissions: true,
              cfnCapabilities: [CfnCapabilities.ANONYMOUS_IAM],
              role: sandboxCodeDeployRole,
              deploymentRole: sandboxCloudFormationRole,
            }),
          ],
        },
      ],
    });

    // Add the target accounts to the pipeline policy
    pipeline.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['sts:AssumeRole'],
        resources: [
          `arn:aws:iam::${devConfig.env.account}:role/*`,
          `arn:aws:iam::${sandboxConfig.env.account}:role/*`,
        ],
      }),
    );
  }
}
