import { Construct } from 'constructs'
import * as budgets from 'aws-cdk-lib/aws-budgets'

export type BudgetServiceTypes =
  | 'AWS CloudTrail'
  | 'AWS CodeArtifact'
  | 'AWS Config'
  | 'AWS Data Transfer'
  | 'AWS Key Management Service'
  | 'AWS Lambda'
  | 'AWS Secrets Manager'
  | 'AWS Service Catalog'
  | 'AWS Step Functions'
  | 'AWS X-Ray'
  | 'Amazon API Gateway'
  | 'Amazon CloudFront'
  | 'Amazon DynamoDB'
  | 'Amazon EC2 Container Registry (ECR)'
  | 'EC2 - Other'
  | 'Amazon Elastic Compute Cloud - Compute'
  | 'Amazon GuardDuty'
  | 'Amazon Kinesis'
  | 'Amazon Route 53'
  | 'Amazon Simple Notification Service'
  | 'Amazon Simple Queue Service'
  | 'Amazon Simple Storage Service'
  | 'Amazon Virtual Private Cloud'
  | 'AmazonCloudWatch'
  | 'CodeBuild'
  | 'AWS CodePipeline'
  | 'Elastic MapReduce'
  | 'Glue'

export const createBudget = (
  scope: Construct,
  options: {
    budgetName: string
    budgetAmount: number
    budgetServiceType: BudgetServiceTypes[]
    region: string
  }
) => {
  const { budgetName, budgetAmount, budgetServiceType, region } = options

  new budgets.CfnBudget(scope, `${budgetName}Budget`, {
    budget: {
      budgetName: `${budgetName}Budget${region}`,
      budgetType: 'COST',
      timeUnit: 'MONTHLY',
      budgetLimit: {
        unit: 'USD',
        amount: budgetAmount,
      },
      costTypes: {
        includeSupport: true,
        includeOtherSubscription: true,
        includeTax: true,
        includeSubscription: true,
        includeUpfront: true,
        includeDiscount: false,
        includeCredit: false,
        includeRecurring: true,
        includeRefund: false,
      },
      costFilters: {
        Service: budgetServiceType,
        Region: [options.region],
      },
    },
    notificationsWithSubscribers: [
      {
        subscribers: ['chia', 'tim', 'nadig', 'aman'].map((email) => ({
          subscriptionType: 'EMAIL',
          address: email + '@flagright.com',
        })),
        notification: {
          notificationType: 'ACTUAL',
          comparisonOperator: 'GREATER_THAN',
          threshold: 90,
          thresholdType: 'PERCENTAGE',
        },
      },
    ],
  })
}
