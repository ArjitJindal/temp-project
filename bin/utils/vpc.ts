import { Construct } from 'constructs'
import { SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2'

export const getVpc = (scope: Construct) => {
  const vpc = new Vpc(scope, 'vpc-codebuild', {
    subnetConfiguration: [
      {
        subnetType: SubnetType.PRIVATE_WITH_EGRESS,
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

  return vpc
}
