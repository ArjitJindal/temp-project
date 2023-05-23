import { Construct } from 'constructs'
import {
  aws_codepipeline as codepipeline,
  aws_codepipeline_actions as codepipeline_actions,
  aws_codecommit as codecommit,
  aws_codebuild as codebuild,
  aws_iam as iam,
} from 'aws-cdk-lib'

import { BaseStack, StackCommonProps } from '../../../lib/base/base-stack'
import { CICDPipelineStackConfig } from '../../../lib/utils/types'

export class CicdPipelineStack extends BaseStack {
  private sourceOutput!: codepipeline.Artifact

  constructor(
    scope: Construct,
    props: StackCommonProps,
    stackConfig: CICDPipelineStackConfig
  ) {
    super(scope, stackConfig.Name, props, stackConfig)

    const repositoryName: string = stackConfig.RepositoryName
    const branchName: string = stackConfig.BranchName

    if (repositoryName.trim().length > 0 && branchName.trim().length > 0) {
      const pipeline = new codepipeline.Pipeline(this, 'CICDPipeline', {
        pipelineName: `${this.projectPrefix}-CICD-Pipeline`,
      })

      const sourceStage = pipeline.addStage({ stageName: 'Source' })
      sourceStage.addAction(
        this.createSourceStageAction('CodeCommit', repositoryName, branchName)
      )

      const buildStage = pipeline.addStage({ stageName: 'BuildDeploy' })
      buildStage.addAction(
        this.createBuildDeployStageAction(
          'BuildDeploy',
          'script/cicd/buildspec_cdk_deploy.yml'
        )
      )
    } else {
      console.info("No CodeCommit repository, so don't create CodePipeline")
    }
  }

  private createSourceStageAction(
    actionName: string,
    repositoryName: string,
    branchName: string
  ): codepipeline.IAction {
    const repo = codecommit.Repository.fromRepositoryName(
      this,
      `${this.projectPrefix}-CodeCommit-Repository`,
      repositoryName
    )

    this.sourceOutput = new codepipeline.Artifact('SourceOutput')
    const sourceAction = new codepipeline_actions.CodeCommitSourceAction({
      actionName: actionName,
      repository: repo,
      output: this.sourceOutput,
      branch: branchName,
    })

    return sourceAction
  }

  private createBuildDeployStageAction(
    actionName: string,
    buildSpecPath: string
  ): codepipeline.IAction {
    const project = new codebuild.PipelineProject(
      this,
      `${actionName}-Project`,
      {
        environment: {
          buildImage: codebuild.LinuxBuildImage.STANDARD_4_0,
          privileged: true,
          computeType: codebuild.ComputeType.MEDIUM,
        },
        environmentVariables: {
          PROJECT_PREFIX: { value: `${this.projectPrefix}` },
        },
        buildSpec: codebuild.BuildSpec.fromSourceFilename(buildSpecPath),
      }
    )

    const commonPolicy = this.getDeployCommonPolicy()
    project.addToRolePolicy(commonPolicy)
    const servicePolicy = this.getServiceSpecificPolicy()
    project.addToRolePolicy(servicePolicy)

    const buildOutput = new codepipeline.Artifact(`${actionName}BuildOutput`)

    const buildAction = new codepipeline_actions.CodeBuildAction({
      actionName: actionName,
      project,
      input: this.sourceOutput,
      outputs: [buildOutput],
    })

    return buildAction
  }

  private getDeployCommonPolicy(): iam.PolicyStatement {
    const statement = new iam.PolicyStatement()
    statement.addActions(
      'cloudformation:*',
      's3:*',
      'lambda:*',
      'ssm:*',
      'iam:*',
      'kms:*',
      'events:*'
    )
    statement.addResources('*')

    return statement
  }

  private getServiceSpecificPolicy(): iam.PolicyStatement {
    const statement = new iam.PolicyStatement()
    statement.addActions(
      'ec2:*',
      'cloudwatch:*',
      'sagemaker:*',
      'ses:*',
      'sns:*',
      'application-autoscaling:*',
      'apigateway:*',
      'logs:*',
      'lambda:*',
      'elasticloadbalancingv2:*',
      'elasticloadbalancing:*'
    )
    statement.addResources('*')

    return statement
  }
}
