import * as cdk from 'aws-cdk-lib'
import { CfnCapabilities, CfnOutput, RemovalPolicy } from 'aws-cdk-lib'
import * as kms from 'aws-cdk-lib/aws-kms'
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline'
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions'
import * as s3 from 'aws-cdk-lib/aws-s3'
import * as iam from 'aws-cdk-lib/aws-iam'
import * as codebuild from 'aws-cdk-lib/aws-codebuild'

import { Construct } from 'constructs'
import { config as deployConfig } from './configs/config-deployment'
import { config as devConfig } from './configs/config-dev'
import { config as sandboxConfig } from './configs/config-sandbox'
import { CdkTarponStack } from './cdk-tarpon-stack'

const PIPELINE_NAME = 'tarpon-pipeline'

export interface CdkTarponPipelineStackProps extends cdk.StackProps {
  readonly devTarponStack: CdkTarponStack
  readonly sandboxTarponStack: CdkTarponStack
}

export class CdkTarponPipelineStack extends cdk.Stack {
  constructor(
    scope: Construct,
    id: string,
    props: CdkTarponPipelineStackProps
  ) {
    super(scope, id, props)

    // Resolve ARNs of cross-account roles for the Dev account
    const devCloudFormationRole = iam.Role.fromRoleArn(
      this,
      'DevDeploymentRole',
      `arn:aws:iam::${devConfig.env.account}:role/CloudFormationDeploymentRole`,
      {
        mutable: false,
      }
    )
    const devCodeDeployRole = iam.Role.fromRoleArn(
      this,
      'DevCrossAccountRole',
      `arn:aws:iam::${devConfig.env.account}:role/CodePipelineCrossAccountRole`,
      {
        mutable: false,
      }
    )

    // Resolve ARNS of cross-account roles for the Sandbox account
    const sandboxCloudFormationRole = iam.Role.fromRoleArn(
      this,
      'ProdDeploymentRole',
      `arn:aws:iam::${sandboxConfig.env.account}:role/CloudFormationDeploymentRole`,
      {
        mutable: false,
      }
    )
    const sandboxCodeDeployRole = iam.Role.fromRoleArn(
      this,
      'ProdCrossAccountRole',
      `arn:aws:iam::${sandboxConfig.env.account}:role/CodePipelineCrossAccountRole`,
      {
        mutable: false,
      }
    )

    // Resolve root Principal ARNs for both deployment accounts
    const devAccountRootPrincipal = new iam.AccountPrincipal(
      devConfig.env.account
    )
    const sandboxAccountRootPrincipal = new iam.AccountPrincipal(
      sandboxConfig.env.account
    )

    // Create KMS key and update policy with cross-account access
    const key = new kms.Key(this, 'ArtifactKey', {
      alias: 'key/pipeline-artifact-key',
    })
    key.grantDecrypt(devAccountRootPrincipal)
    key.grantDecrypt(devCodeDeployRole)
    key.grantDecrypt(sandboxAccountRootPrincipal)
    key.grantDecrypt(sandboxCodeDeployRole)

    // Create S3 bucket with target account cross-account access
    const artifactBucket = new s3.Bucket(this, 'ArtifactBucket', {
      bucketName: `artifact-bucket-${this.account}`,
      removalPolicy: RemovalPolicy.DESTROY,
      encryption: s3.BucketEncryption.KMS,
      encryptionKey: key,
    })
    artifactBucket.grantPut(devAccountRootPrincipal)
    artifactBucket.grantRead(devAccountRootPrincipal)
    artifactBucket.grantPut(sandboxAccountRootPrincipal)
    artifactBucket.grantRead(sandboxAccountRootPrincipal)

    // CDK build definition
    const cdkBuild = new codebuild.PipelineProject(this, 'CdkBuild', {
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
          files: ['*tarpon.template.json'],
        },
      }),
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_5_0,
      },
      // use the encryption key for build artifacts
      encryptionKey: key,
    })

    // Define pipeline stage output artifacts
    const sourceOutput = new codepipeline.Artifact()
    const cdkBuildOutput = new codepipeline.Artifact('CdkBuildOutput')

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
              templatePath: cdkBuildOutput.atPath('dev-tarpon.template.json'),
              stackName: 'DevTarponDeploymentStack',
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
              templatePath: cdkBuildOutput.atPath(
                'sandbox-tarpon.template.json'
              ),
              stackName: 'SandboxTarponDeploymentStack',
              adminPermissions: true,
              cfnCapabilities: [CfnCapabilities.ANONYMOUS_IAM],
              role: sandboxCodeDeployRole,
              deploymentRole: sandboxCloudFormationRole,
            }),
          ],
        },
      ],
    })

    // Add the target accounts to the pipeline policy
    pipeline.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['sts:AssumeRole'],
        resources: [
          `arn:aws:iam::${devConfig.env.account}:role/*`,
          `arn:aws:iam::${sandboxConfig.env.account}:role/*`,
        ],
      })
    )

    // Publish the KMS Key ARN as an output
    new CfnOutput(this, 'ArtifactBucketEncryptionKeyArn', {
      value: key.keyArn,
      exportName: 'ArtifactBucketEncryptionKey',
    })
  }
}
