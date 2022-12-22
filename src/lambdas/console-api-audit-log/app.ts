import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { AuditLogRepository } from '@/services/audit-log/repositories/auditlog-repository'
import { DefaultApiGetAuditlogRequest } from '@/@types/openapi-internal/RequestParameters'

export const auditLogHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { principalId: tenantId } = event.requestContext.authorizer
    const mongoDb = await getMongoDbClient()
    const {
      page,
      pageSize,
      afterTimestamp,
      beforeTimestamp,
      sortField,
      sortOrder,
      filterTypes,
      filterActionTakenBy,
    } = event.queryStringParameters as any

    const params: DefaultApiGetAuditlogRequest = {
      page,
      pageSize,
      afterTimestamp: parseInt(afterTimestamp) || undefined,
      beforeTimestamp: parseInt(beforeTimestamp),
      sortField: sortField,
      sortOrder: sortOrder,
      filterTypes: filterTypes ? filterTypes.split(',') : undefined,
      filterActionTakenBy: filterActionTakenBy
        ? filterActionTakenBy.split(',')
        : undefined,
    }
    const auditLogRepository = new AuditLogRepository(tenantId, mongoDb)
    const results = await auditLogRepository.getAllAuditLogs(params)
    return results
  }
)
