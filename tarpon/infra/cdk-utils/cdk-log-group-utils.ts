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
    isDev?: boolean
    name: string
  }
): void => {
  const { isDev, name } = options

  const logGroup = new LogGroup(scope, `log-group-${name}`, {
    logGroupName: `/aws/vpc/${name}`,
    retention: isDev ? RetentionDays.TWO_WEEKS : undefined,
  })

  vpc.addFlowLog(`flow-log-${name}`, {
    destination: FlowLogDestination.toCloudWatchLogs(logGroup),
    trafficType: FlowLogTrafficType.ALL,
  })
}
