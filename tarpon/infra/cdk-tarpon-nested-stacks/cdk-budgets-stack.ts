import * as cdk from 'aws-cdk-lib'
import { Construct } from 'constructs'
import {
  BudgetServiceTypes,
  createBudget,
} from '@flagright/lib/cdk-utils/budgets'
import { Config } from '@flagright/lib/config/config'
import { lowerCase, startCase } from 'lodash'

interface BudgetProps extends cdk.NestedStackProps {
  config: Config
}

export class CdkBudgetStack extends cdk.NestedStack {
  constructor(scope: Construct, id: string, props: BudgetProps) {
    super(scope, id, props)

    const budgetConfigs: Record<keyof Config['budgets'], BudgetServiceTypes[]> =
      {
        CLOUDWATCH: ['AmazonCloudWatch'],
        DYNAMODB: ['Amazon DynamoDB'],
        LAMBDA: ['AWS Lambda'],
        S3: ['Amazon Simple Storage Service'],
        SQS: ['Amazon Simple Queue Service'],
        EMR: ['Elastic MapReduce'],
        EC2: [
          'Amazon Elastic Compute Cloud - Compute',
          'EC2 - Other',
          'Amazon EC2 Container Registry (ECR)',
        ],
        GUARDDUTY: ['Amazon GuardDuty'],
        GLUE: ['Glue'],
        KINESIS: ['Amazon Kinesis'],
        SECRETS_MANAGER: ['AWS Secrets Manager'],
        VPC: ['Amazon Virtual Private Cloud'],
      }

    Object.entries(budgetConfigs).forEach(([key, value]) => {
      createBudget(this, {
        budgetName: `${props.config.stage}-${startCase(lowerCase(key))}`,
        budgetAmount: props.config.budgets[key],
        budgetServiceType: value,
        region: props.config.env.region as string,
      })
    })
  }
}
