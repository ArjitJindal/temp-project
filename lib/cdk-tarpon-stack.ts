import * as cdk from '@aws-cdk/core'
import { AttributeType, Table } from '@aws-cdk/aws-dynamodb'
import { CfnOutput, Duration } from '@aws-cdk/core'
import { Code, Function, Runtime, Tracing } from '@aws-cdk/aws-lambda'
import { LambdaIntegration, LambdaRestApi } from '@aws-cdk/aws-apigateway'

export class CdkTarponStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    /**
     * DynamoDB
     */
    const transactionTable = new Table(this, 'Transactions', {
      tableName: 'Transactions',
      // tenantID for primary item
      partitionKey: { name: 'PartitionKeyID', type: AttributeType.STRING },
      // transactionID for primary item
      sortKey: { name: 'SortKeyID', type: AttributeType.STRING },
      readCapacity: 1,
      writeCapacity: 1,
    })

    /**
     * Lambda Functions
     */
    const postRulesEngineFunction = new Function(
      this,
      'PostRulesEngineFunction',
      {
        functionName: 'PostRulesEngineFunction',
        runtime: Runtime.NODEJS_14_X,
        handler: 'dist/app.lambdaHandler',
        code: Code.fromAsset('src/rules-engine'),
        tracing: Tracing.DISABLED,
        timeout: Duration.seconds(10),
      }
    )
    transactionTable.grantReadWriteData(postRulesEngineFunction)

    /**
     * API Gateway
     */

    // TODO: CDK+OpenAPI integration (issue: https://github.com/aws/aws-cdk/issues/1461)
    const api = new LambdaRestApi(this, 'TarponAPI', {
      handler: postRulesEngineFunction, // TODO: create default handler,
      proxy: false,
    })
    const transactions = api.root.addResource('transaction')
    transactions.addMethod(
      'POST',
      new LambdaIntegration(postRulesEngineFunction)
    )

    /**
     * Outputs
     */
    new CfnOutput(
      this,
      'API Gateway endpoint URL for Prod stage for Rules Engine function',
      {
        value: api.urlForPath('/'),
      }
    )
    new CfnOutput(this, 'Post Rules Engine Function Name', {
      value: postRulesEngineFunction.functionName,
    })

    new CfnOutput(this, 'Transaction Table', {
      value: transactionTable.tableName,
    })
  }
}
