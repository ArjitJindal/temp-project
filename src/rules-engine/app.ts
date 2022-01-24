import * as AWS from 'aws-sdk'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyResult,
  APIGatewayProxyWithLambdaAuthorizerHandler,
} from 'aws-lambda'

import highRiskCountry from './rulesEngine/highRiskCountry'
import { v4 as uuidv4 } from 'uuid'
import { RuleRepository } from './repositories/ruleRepository'
import { getDynamoDbClient } from '../utils/dynamodb'

/**
 *
 * Event doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
 * @param {Object} event - API Gateway Lambda Proxy Input Format
 *
 * Context doc: https://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-context.html
 * @param {Object} context
 *
 * Return doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html
 * @returns {Object} object - API Gateway Lambda Proxy Output Format
 *
 */
export const lambdaHandler: APIGatewayProxyWithLambdaAuthorizerHandler<
  APIGatewayEventLambdaAuthorizerContext<AWS.STS.Credentials>
> = async (event, context) => {
  const {
    AccessKeyId,
    SecretAccessKey,
    SessionToken,
    principalId: tenantId,
  } = event.requestContext.authorizer
  const dynamoDb = new AWS.DynamoDB.DocumentClient({
    credentials: {
      accessKeyId: AccessKeyId,
      secretAccessKey: SecretAccessKey,
      sessionToken: SessionToken,
    },
  })

  let response: APIGatewayProxyResult = { statusCode: 500, body: 'ERROR' }
  try {
    console.log(`Context: ${JSON.stringify(context)}`)
    console.log(`Event: ${JSON.stringify(event)}`)
    const body = event.body && JSON.parse(event.body)
    const transactionID = uuidv4()

    const params = {
      TableName: 'Transactions',
      Item: {
        PartitionKeyID: tenantId + '#' + transactionID,
        SortKeyID: 'thingsyouwontbelieve',
        userID: body.userID,
        sendingAmountDetails: body.sendingAmountDetails,
        receivingAmountDetails: body.receivingAmountDetails,
        paymentMethod: body.paymentMethod,
        payoutMethod: body.payoutMethod,
        timestamp: body.timestamp,
        senderName: body.senderName,
        receiverName: body.receiverName,
        promotionCodeUsed: body.promotionCodeUsed,
        productType: body.productType,
        senderCardDetails: body.senderName,
        receiverCardDetails: body.receiverCardDetails,
        senderBankDetails: body.senderBankDetails,
        receiverBankDetails: body.receiverBankDetails,
        reference: body.reference,
        deviceData: body.deviceData,
        tags: body.tags,
      },
      ReturnConsumedCapacity: 'TOTAL',
    }

    try {
      await dynamoDb.put(params).promise()
      try {
        const ruleResult = highRiskCountry(
          body,
          'receivingAmountDetails',
          'AF',
          'ALLOW'
        )
        response = {
          statusCode: 200,
          body: JSON.stringify({
            message: 'success',
            transactionID: transactionID,
            rules: [ruleResult],
          }),
        }
      } catch (e: any) {
        console.log('ERROR IN CALLING RULE')
        console.log(e)
        response = {
          statusCode: 500,
          body: JSON.stringify({
            error: e.message,
          }),
        }
      }
    } catch (dbError: any) {
      let errorResponse = `Error: Execution update, caused a Dynamodb error, please look at your logs.`
      if (dbError.code === 'ValidationException') {
        if (dbError.message.includes('reserved keyword'))
          errorResponse = `Error: You're using AWS reserved keywords as attributes`
      }
      console.log(dbError)
      response = {
        statusCode: 500,
        body: JSON.stringify({
          error: errorResponse,
        }),
      }
    }
  } catch (err: any) {
    console.log('ERROR IN RETURNING  RESPONSES')
    console.log(err)
    response = {
      statusCode: 500,
      body: JSON.stringify({
        error: err.message,
      }),
    }
  }

  return response
}

export type RuleInstanceQueryStringParameters = {
  tenantId: string
}

export const ruleInstanceHandler: APIGatewayProxyWithLambdaAuthorizerHandler<
  APIGatewayEventLambdaAuthorizerContext<AWS.STS.Credentials>
> = async (event) => {
  const { tenantId } =
    event.queryStringParameters as RuleInstanceQueryStringParameters
  const dynamoDb = getDynamoDbClient(event)
  const ruleRepository = new RuleRepository(tenantId, dynamoDb)
  const ruleInstanceId = event.pathParameters?.id

  if (event.httpMethod === 'PUT' && ruleInstanceId) {
    if (!event.body) {
      throw new Error('missing payload!')
    }
    await ruleRepository.createOrUpdateRuleInstance(JSON.parse(event.body))
    return {
      statusCode: 200,
      body: 'OK',
    }
  } else if (event.httpMethod === 'DELETE' && ruleInstanceId) {
    await ruleRepository.deleteRuleInstance(ruleInstanceId)
    return {
      statusCode: 200,
      body: 'OK',
    }
  } else if (event.httpMethod === 'POST' && !ruleInstanceId) {
    if (!event.body) {
      throw new Error('missing payload!')
    }
    const newRuleInstance = await ruleRepository.createOrUpdateRuleInstance(
      JSON.parse(event.body)
    )
    return {
      statusCode: 200,
      body: JSON.stringify(newRuleInstance),
    }
  }

  throw new Error('Unhandled request')
}
