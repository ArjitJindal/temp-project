import { Construct } from 'constructs'
import { aws_iam as iam } from 'aws-cdk-lib'
import { DeployConfig } from '../../tarpon/lib/configs/config-deployment'

export const getCodeDeployRole = (
  scope: Construct,
  deployConfig: DeployConfig
) => {
  return iam.Role.fromRoleArn(
    scope,
    'DeployCodePipelineDeployRole',
    `arn:aws:iam::${deployConfig.env.account}:role/CodePipelineDeployRole`,
    {
      mutable: false,
    }
  )
}
