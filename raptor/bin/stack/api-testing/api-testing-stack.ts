import { Construct } from 'constructs'
import {
  aws_sns as sns,
  aws_sns_subscriptions as subs,
  aws_iam as iam,
  aws_lambda as lambda,
  Duration,
  CfnOutput,
} from 'aws-cdk-lib'

import { BaseStack, StackCommonProps } from '../../../lib/base/base-stack'
import { APITestingStackConfig } from '../../../lib/utils/types'

interface LambdaProps {
  name: string
  apiEndpoint: string
  role: iam.Role
  testDurationInSec: number
  testIntervalInSec: number
  snsTopic: sns.Topic
}

export class APITestingStack extends BaseStack {
  constructor(
    scope: Construct,
    props: StackCommonProps,
    stackConfig: APITestingStackConfig
  ) {
    super(scope, stackConfig.Name, props, stackConfig)

    const snsTopic = this.createSnsTopic(stackConfig.SNSTopicName)
    this.putParameter('testTriggerSnsTopicName', snsTopic.topicName)

    const role = this.createLambdaRole('TestTrigger-Lambda')
    const apiEndpoint: string = this.getParameter('apiEndpoint')
    for (let index = 0; index < stackConfig.TestClientCount; index++) {
      this.createLambdaFunction({
        name: `${stackConfig.LambdaFunctionName}${String(index + 1).padStart(
          3,
          '0'
        )}`,
        apiEndpoint: apiEndpoint,
        role: role,
        testDurationInSec: stackConfig.TestDurationInSec,
        testIntervalInSec: stackConfig.TestIntervalInSec,
        snsTopic: snsTopic,
      })
    }
  }

  private createSnsTopic(name: string): sns.Topic {
    const topic = new sns.Topic(this, name, {
      displayName: `${this.projectPrefix}-${name}-Topic`,
      topicName: `${this.projectPrefix}-${name}-Topic`,
    })

    new CfnOutput(this, 'name', {
      value: topic.topicArn,
    })

    return topic
  }

  private createLambdaRole(baseName: string): iam.Role {
    const role = new iam.Role(this, `${baseName}-Role`, {
      roleName: `${this.projectPrefix}-${baseName}-Role`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    })
    role.addManagedPolicy({
      managedPolicyArn:
        'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole',
    })
    role.addManagedPolicy({
      managedPolicyArn: 'arn:aws:iam::aws:policy/CloudWatchFullAccess',
    })
    return role
  }

  private createLambdaFunction(props: LambdaProps): lambda.Function {
    const baseName = `${props.name}-Lambda`
    const fullName = `${this.projectPrefix}-${baseName}`

    const lambdaPath = 'codes/lambda/api-testing-tester/src'

    const lambdaFunction = new lambda.Function(this, baseName, {
      functionName: fullName,
      code: lambda.Code.fromAsset(lambdaPath),
      handler: 'handler.handle',
      runtime: lambda.Runtime.PYTHON_3_7,
      timeout: Duration.minutes(15), // MAX 15 minutes
      memorySize: 256,
      role: props.role,
      retryAttempts: 0,
      environment: {
        API_ENDPOINT: props.apiEndpoint,
        PROJECT_NAME: this.commonProps.appConfig.Project.Name,
        PROJECT_STAGE: this.commonProps.appConfig.Project.Stage,
      },
    })

    props.snsTopic.addSubscription(new subs.LambdaSubscription(lambdaFunction))

    return lambdaFunction
  }
}
