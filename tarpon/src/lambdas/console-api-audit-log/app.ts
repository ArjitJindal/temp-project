import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { Handlers } from '@/@types/openapi-internal-custom/DefaultApi'
import { AuditLogService } from '@/services/audit-log'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'

export const auditLogHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClientByEvent(event)
    const handlers = new Handlers()

    handlers.registerGetAuditlog(async (ctx, request) => {
      const { tenantId } = ctx
      const auditLogService = new AuditLogService(tenantId, {
        mongoDb,
        dynamoDb,
      })
      return await auditLogService.getAllAuditLogs(request)
    })

    return await handlers.handle(event)
  }
)
