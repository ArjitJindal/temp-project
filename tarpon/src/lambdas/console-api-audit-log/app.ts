import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { AuditLogRepository } from '@/services/audit-log/repositories/auditlog-repository'
import { Handlers } from '@/@types/openapi-internal-custom/DefaultApi'

export const auditLogHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const mongoDb = await getMongoDbClient()
    const handlers = new Handlers()

    handlers.registerGetAuditlog(async (ctx, request) => {
      const { tenantId } = ctx
      const auditLogRepository = new AuditLogRepository(tenantId, mongoDb)
      return await auditLogRepository.getAllAuditLogs(request)
    })

    return await handlers.handle(event)
  }
)
