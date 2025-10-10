import {
  FlowLogDestination,
  FlowLogTrafficType,
  IVpc,
} from 'aws-cdk-lib/aws-ec2'
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs'
import { Construct } from 'constructs'

export const createVpcLogGroup = (
  scope: Construct,
  vpc: IVpc,
  options: {
    name: string
    logRetention: RetentionDays
  }
): void => {
  const { name, logRetention } = options

  const logGroup = new LogGroup(scope, `log-group-${name}`, {
    logGroupName: `/aws/vpc/${name}`,
    retention: logRetention,
  })

  vpc.addFlowLog(`flow-log-${name}`, {
    destination: FlowLogDestination.toCloudWatchLogs(logGroup),
    trafficType: FlowLogTrafficType.ALL,
  })
}
