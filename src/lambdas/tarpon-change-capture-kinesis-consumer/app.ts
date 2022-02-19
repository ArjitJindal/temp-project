import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerHandler,
  KinesisStreamEvent,
} from 'aws-lambda'
import { RuleInstanceQueryStringParameters } from '../rules-engine/app'
import { getDynamoDbClient } from '../../utils/dynamodb'
import { TransactionRepository } from '../rules-engine/repositories/transaction-repository'

export const tarponChangeCaptureHandler = async (event: KinesisStreamEvent) => {
  console.log('Kinesis Event')
  console.log(event)
}
