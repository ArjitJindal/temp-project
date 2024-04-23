import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import {
  RULE_LOGIC_CONFIG_S3_KEY,
  RuleService,
  getRuleLogicConfig,
} from '@/services/rules-engine/rule-service'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { Handlers } from '@/@types/openapi-internal-custom/DefaultApi'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { RuleInstanceService } from '@/services/rules-engine/rule-instance-service'
import { getS3ClientByEvent } from '@/utils/s3'
import { envIs } from '@/utils/env'

export const ruleHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const tenantId = (event.requestContext.authorizer?.principalId ||
      event.queryStringParameters?.tenantId) as string
    const dynamoDb = getDynamoDbClientByEvent(event)
    const mongoDb = await getMongoDbClient()
    const ruleService = new RuleService(tenantId, { dynamoDb, mongoDb })

    const handlers = new Handlers()

    handlers.registerGetRuleLogicConfig(async () => {
      // NOTE: rule logic config is over 10MB which is the max size for API Gateway response,
      // so we need to get it from S3 instead
      const s3 = getS3ClientByEvent(event)
      const getObjectCommand = new GetObjectCommand({
        Bucket: process.env.SHARED_ASSETS_BUCKET,
        Key: RULE_LOGIC_CONFIG_S3_KEY,
      })
      return {
        s3Url: envIs('local') ? '' : await getSignedUrl(s3, getObjectCommand),
        ruleLogicConfig: envIs('local') ? getRuleLogicConfig() : undefined,
      }
    })

    handlers.registerGetRules(async () => await ruleService.getAllRules())

    handlers.registerGetRule(async (_ctx, request) => {
      return (await ruleService.getRuleById(request.ruleId)) ?? null
    })

    handlers.registerGetRuleFilters(async () => {
      return await ruleService.getAllRuleFilters()
    })

    handlers.registerPostRules(
      async (ctx, request) => await ruleService.createOrUpdateRule(request.Rule)
    )

    handlers.registerPutRuleRuleId(async (ctx, request) => {
      await ruleService.createOrUpdateRule({
        ...request.Rule,
        id: request.ruleId,
      })
      return
    })

    handlers.registerDeleteRulesRuleId(
      async (ctx, request) => await ruleService.deleteRule(request.ruleId)
    )

    handlers.registerGetRulesSearch(async (ctx, request) => {
      const { queryStr = '', ...rest } = request

      return await ruleService.searchRules(queryStr, rest)
    })

    return await handlers.handle(event)
  }
)

export const ruleInstanceHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<JWTAuthorizerResult>
    >
  ) => {
    const tenantId = (event.requestContext.authorizer?.principalId ||
      event.queryStringParameters?.tenantId) as string
    const dynamoDb = getDynamoDbClientByEvent(event)
    const mongoDb = await getMongoDbClient()
    const ruleInstanceService = new RuleInstanceService(tenantId, {
      dynamoDb,
      mongoDb,
    })
    const handlers = new Handlers()

    handlers.registerGetRuleInstances(
      async () => await ruleInstanceService.getAllRuleInstances()
    )

    handlers.registerGetRuleInstancesItem(
      async (ctx, request) =>
        await ruleInstanceService.getRuleInstanceById(request.ruleInstanceId)
    )

    handlers.registerPutRuleInstancesRuleInstanceId(async (ctx, request) => {
      return await ruleInstanceService.putRuleInstance(
        request.ruleInstanceId,
        request.RuleInstance
      )
    })

    handlers.registerDeleteRuleInstancesRuleInstanceId(
      async (ctx, request) =>
        await ruleInstanceService.deleteRuleInstance(request.ruleInstanceId)
    )

    handlers.registerPostRuleInstances(
      async (ctx, request) =>
        await ruleInstanceService.createRuleInstance({
          ...request.RuleInstance,
          createdBy: ctx.userId,
        })
    )

    handlers.registerGetRuleInstancesNewRuleId(async (ctx, request) => {
      const { ruleId } = request
      return {
        ruleInstanceId: await ruleInstanceService.getNewRuleInstanceId(ruleId),
      }
    })

    return await handlers.handle(event)
  }
)
