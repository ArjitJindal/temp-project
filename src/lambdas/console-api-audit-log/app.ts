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
      limit,
      skip,
      afterTimestamp,
      beforeTimestamp,
      sortField,
      sortOrder,
      filterTypes,
    } = event.queryStringParameters as any

    const params: DefaultApiGetAuditlogRequest = {
      limit: parseInt(limit),
      skip: parseInt(skip),
      afterTimestamp: parseInt(afterTimestamp) || undefined,
      beforeTimestamp: parseInt(beforeTimestamp),
      sortField: sortField,
      sortOrder: sortOrder,
      filterTypes: filterTypes ? filterTypes.split(',') : undefined,
    }
    const auditLogRepository = new AuditLogRepository(tenantId, mongoDb)
    const results = await auditLogRepository.getAllAuditLogs(params)
    return results
  }
)
