import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { Forbidden, NotFound } from 'http-errors'
import { UserService } from './services/user-service'
import { UserAuditLogService } from './services/user-audit-log-service'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { addNewSubsegment } from '@/core/xray'
import { getS3ClientByEvent } from '@/utils/s3'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { UserUpdateRequest } from '@/@types/openapi-internal/UserUpdateRequest'
import { Comment } from '@/@types/openapi-internal/Comment'
import { SalesforceService } from '@/services/salesforce'
import { TenantRepository } from '@/services/tenants/repositories/tenant-repository'
import { hasFeature } from '@/core/utils/context'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { AlertsRepository } from '@/services/rules-engine/repositories/alerts-repository'

export type UserViewConfig = {
  TMP_BUCKET: string
  DOCUMENT_BUCKET: string
}

export const businessUsersViewHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { principalId: tenantId } = event.requestContext.authorizer
    const { DOCUMENT_BUCKET, TMP_BUCKET } = process.env as UserViewConfig
    const s3 = getS3ClientByEvent(event)
    const client = await getMongoDbClient()
    const dynamoDb = getDynamoDbClientByEvent(event)
    const userService = new UserService(
      tenantId,
      {
        mongoDb: client,
        dynamoDb,
      },
      s3,
      TMP_BUCKET,
      DOCUMENT_BUCKET
    )

    if (event.httpMethod === 'GET' && event.path.endsWith('/business/users')) {
      const {
        page,
        pageSize,
        afterTimestamp,
        beforeTimestamp,
        filterId,
        filterName,
        filterOperator,
        filterBusinessIndustries,
        filterTagKey,
        filterTagValue,
        filterRiskLevel,
        filterUserRegistrationStatus,
        sortField,
        sortOrder,
      } = event.queryStringParameters as any
      const businessUserSegment = await addNewSubsegment(
        'User Service',
        'Get Business Users'
      )
      businessUserSegment?.addAnnotation('tenantId', tenantId)
      businessUserSegment?.addAnnotation(
        'getParams',
        JSON.stringify(event.queryStringParameters)
      )
      const result = await userService.getBusinessUsers({
        page,
        pageSize,
        afterTimestamp: parseInt(afterTimestamp) || undefined,
        beforeTimestamp: parseInt(beforeTimestamp),
        filterId,
        filterName,
        filterOperator,
        filterBusinessIndustries: filterBusinessIndustries
          ? filterBusinessIndustries.split(',')
          : undefined,
        filterTagKey,
        filterTagValue,
        filterRiskLevel: filterRiskLevel
          ? filterRiskLevel.split(',')
          : undefined,
        filterUserRegistrationStatus: filterUserRegistrationStatus
          ? filterUserRegistrationStatus.split(',')
          : undefined,
        sortField,
        sortOrder,
      })
      businessUserSegment?.close()
      return result
    } else if (
      event.httpMethod === 'GET' &&
      event.resource === '/business/users/{userId}' &&
      event.pathParameters?.userId
    ) {
      const user = await userService.getBusinessUser(
        event.pathParameters?.userId
      )
      if (user == null) {
        throw new NotFound(`Unable to find user by id`)
      }
      const CasesAlertsAuditLogService = new UserAuditLogService(tenantId)
      await CasesAlertsAuditLogService.handleAuditLogForuserViewed(
        event.pathParameters?.userId
      )
      return user
    } else if (
      event.httpMethod === 'POST' &&
      event.resource === '/business/users/{userId}' &&
      event.pathParameters?.userId &&
      event.body
    ) {
      const updateRequest = JSON.parse(event.body) as UserUpdateRequest
      return userService.updateBusinessUser(
        event.pathParameters.userId,
        updateRequest
      )
    } else if (
      event.httpMethod === 'GET' &&
      event.path.endsWith('/users/uniques')
    ) {
      const { field, filter } = event.queryStringParameters as any
      return (await userService.getUniques({ field, filter })).filter(
        (item) => item != null
      )
    }
  }
)

export const consumerUsersViewHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { principalId: tenantId } = event.requestContext.authorizer
    const { DOCUMENT_BUCKET, TMP_BUCKET } = process.env as UserViewConfig
    const s3 = getS3ClientByEvent(event)
    const client = await getMongoDbClient()
    const dynamoDb = getDynamoDbClientByEvent(event)
    const userService = new UserService(
      tenantId,
      {
        mongoDb: client,
        dynamoDb,
      },
      s3,
      TMP_BUCKET,
      DOCUMENT_BUCKET
    )
    if (event.httpMethod === 'GET' && event.path.endsWith('/consumer/users')) {
      const {
        page,
        pageSize,
        afterTimestamp,
        beforeTimestamp,
        filterId,
        filterName,
        filterOperator,
        filterTagKey,
        filterTagValue,
        filterRiskLevel,
        sortField,
        sortOrder,
      } = event.queryStringParameters as any
      const consumerUserSegment = await addNewSubsegment(
        'User Service',
        'Get Consumer Users'
      )
      consumerUserSegment?.addAnnotation('tenantId', tenantId)
      consumerUserSegment?.addAnnotation(
        'getParams',
        JSON.stringify(event.queryStringParameters)
      )
      const result = await userService.getConsumerUsers({
        page,
        pageSize,
        afterTimestamp: parseInt(afterTimestamp) || undefined,
        beforeTimestamp: parseInt(beforeTimestamp),
        filterId,
        filterName,
        filterOperator,
        filterTagKey,
        filterTagValue,
        filterRiskLevel: filterRiskLevel
          ? filterRiskLevel.split(',')
          : undefined,
        sortField,
        sortOrder,
      })
      consumerUserSegment?.close()
      return result
    } else if (
      event.httpMethod === 'POST' &&
      event.resource === '/users/{userId}/comments' &&
      event.pathParameters?.userId &&
      event.body
    ) {
      const comment = JSON.parse(event.body) as Comment
      const savedComment: Comment = await userService.saveUserComment(
        event.pathParameters.userId,
        comment
      )
      return savedComment
    } else if (
      event.httpMethod === 'DELETE' &&
      event.pathParameters?.userId &&
      event.pathParameters?.commentId
    ) {
      return userService.deleteUserComment(
        event.pathParameters.userId,
        event.pathParameters.commentId
      )
    } else if (
      event.httpMethod === 'GET' &&
      event.resource === '/consumer/users/{userId}' &&
      event.pathParameters?.userId
    ) {
      const user = await userService.getConsumerUser(
        event.pathParameters?.userId
      )
      if (user == null) {
        throw new NotFound(`Unable to find user by id`)
      }
      const CasesAlertsAuditLogService = new UserAuditLogService(tenantId)
      await CasesAlertsAuditLogService.handleAuditLogForuserViewed(
        event.pathParameters?.userId
      )
      return user
    } else if (
      event.httpMethod === 'POST' &&
      event.resource === '/consumer/users/{userId}' &&
      event.pathParameters?.userId &&
      event.body
    ) {
      const updateRequest = JSON.parse(event.body) as UserUpdateRequest
      return userService.updateConsumerUser(
        event.pathParameters.userId,
        updateRequest
      )
    }
  }
)

export const allUsersViewHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const { principalId: tenantId, userId } = event.requestContext.authorizer
    const { DOCUMENT_BUCKET, TMP_BUCKET } = process.env as UserViewConfig
    const s3 = getS3ClientByEvent(event)
    const client = await getMongoDbClient()
    const dynamoDb = getDynamoDbClientByEvent(event)
    const userService = new UserService(
      tenantId,
      {
        mongoDb: client,
        dynamoDb,
      },
      s3,
      TMP_BUCKET,
      DOCUMENT_BUCKET
    )

    const alertsRepository = new AlertsRepository(tenantId, {
      mongoDb: client,
      dynamoDb,
    })

    const ruleInstanceRepository = new RuleInstanceRepository(tenantId, {
      dynamoDb,
    })
    if (event.httpMethod === 'GET' && event.path.endsWith('/users')) {
      const {
        page,
        pageSize,
        afterTimestamp,
        beforeTimestamp,
        filterId,
        filterName,
        filterOperator,
        includeCasesCount,
        sortField,
        sortOrder,
        filterRiskLevel,
      } = event.queryStringParameters as any

      return userService.getUsers({
        page,
        pageSize,
        afterTimestamp: parseInt(afterTimestamp) || undefined,
        beforeTimestamp: parseInt(beforeTimestamp),
        filterId,
        filterName,
        filterOperator,
        includeCasesCount: includeCasesCount === 'true',
        sortField,
        filterRiskLevel: filterRiskLevel
          ? filterRiskLevel.split(',')
          : undefined,
        sortOrder,
      })
    } else if (
      event.httpMethod === 'POST' &&
      event.resource === '/users/{userId}/comments' &&
      event.pathParameters?.userId &&
      event.body
    ) {
      const comment = JSON.parse(event.body) as Comment
      const savedComment: Comment = await userService.saveUserComment(
        event.pathParameters.userId,
        { ...comment, userId }
      )
      return savedComment
    } else if (
      event.resource === '/users/{userId}/comments/{commentId}' &&
      event.httpMethod === 'DELETE' &&
      event.pathParameters?.userId &&
      event.pathParameters?.commentId
    ) {
      return userService.deleteUserComment(
        event.pathParameters.userId,
        event.pathParameters.commentId
      )
    } else if (
      event.httpMethod === 'GET' &&
      event.resource === '/users/{userId}/salesforce'
    ) {
      if (!hasFeature('SALESFORCE')) {
        throw new Forbidden('SALESFORCE feature not enabled')
      }
      const { userId } = event.pathParameters as any
      const user = await userService.getUser(userId)
      const dynamoDb = getDynamoDbClientByEvent(event)
      const tenantRepository = new TenantRepository(tenantId, { dynamoDb })
      const settings = await tenantRepository.getTenantSettings()
      return await new SalesforceService(
        settings.salesforceAuthToken as string
      ).getAccount(user)
    } else if (
      event.httpMethod === 'GET' &&
      event.resource === '/users/{userId}/screening-status'
    ) {
      const { userId } = event.pathParameters as any
      const user = await userService.getUser(userId)

      const ruleInstances = await ruleInstanceRepository.getAllRuleInstances()
      const ongoingRuleInstanceIds: string[] = ruleInstances
        .filter(
          (ruleInstance) =>
            ruleInstance.type === 'USER' &&
            ruleInstance.parameters?.ongoingScreening
        )
        .map((x) => x.id)
        .filter((x): x is string => typeof x === 'string')

      if (ongoingRuleInstanceIds.length === 0) {
        return {
          isOngoingScreening: false,
        }
      }

      const alerts = await alertsRepository.getAlerts({
        filterUserId: user.userId,
        filterRuleInstanceId: ongoingRuleInstanceIds,
        pageSize: 1,
      })

      return {
        isOngoingScreening: alerts.data.length > 0,
      }
    }
    throw new Error('Unhandled request')
  }
)
