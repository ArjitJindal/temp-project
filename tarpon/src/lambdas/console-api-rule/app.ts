import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { RuleService } from '@/services/rules-engine/rule-service'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { JWTAuthorizerResult } from '@/@types/jwt'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { Handlers } from '@/@types/openapi-internal-custom/DefaultApi'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { RuleInstanceService } from '@/services/rules-engine/rule-instance-service'
import { LogicEvaluator } from '@/services/logic-evaluator/engine'
import { RuleThresholdOptimizer } from '@/services/rule-threshold'
import { sendBatchJobCommand } from '@/services/batch-jobs/batch-job'
import { S3Service } from '@/services/aws/s3-service'
import { getS3ClientByEvent } from '@/utils/s3'

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

    handlers.registerGetLogicConfig(async (_ctx, request) => {
      const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
      let logicConfig = logicEvaluator.getLogicConfig()

      const { LogicConfigRequest } = request
      const { filterVarNames, excludeSelectOptions } = LogicConfigRequest ?? {}

      if (filterVarNames != null) {
        logicConfig = {
          ...logicConfig,
          variables: logicConfig.variables.filter((v) =>
            filterVarNames.includes(v.key)
          ),
        }
      }
      if (excludeSelectOptions) {
        const clearListValues = (obj: any): any => {
          if (Array.isArray(obj)) {
            return obj.map(clearListValues)
          }
          if (!obj || typeof obj !== 'object') {
            return obj
          }

          if (obj.fieldSettings?.listValues) {
            return {
              ...obj,
              fieldSettings: {
                ...obj.fieldSettings,
                listValues: [],
              },
            }
          }

          return Object.entries(obj).reduce(
            (acc, [key, value]) => ({
              ...acc,
              [key]:
                value && typeof value === 'object'
                  ? clearListValues(value)
                  : value,
            }),
            {}
          )
        }
        logicConfig = {
          ...logicConfig,
          variables: logicConfig.variables.map(clearListValues),
        }
      }
      return {
        logicConfig: logicConfig,
      }
    })

    handlers.registerGetRules(async (_ctx, request) => {
      return (await ruleService.getAllRules(request)).result
    })

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

    handlers.registerGetRuleMlModels(async (ctx, request) => {
      return await ruleService.getAllRuleMlModels(request)
    })

    handlers.registerUpdateRuleMlModelModelId(async (ctx, request) => {
      await ruleService.updateRuleMlModel(request)
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

    handlers.registerGetRuleInstances(async (ctx, request) => {
      const data = await ruleInstanceService.getAllRuleInstances(
        request.mode,
        request.view
      )
      return data.result
    })

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

    handlers.registerGetRuleInstancesRuleInstanceIdStats(
      async (ctx, request) => {
        const { ruleInstanceId, afterTimestamp, beforeTimestamp } = request
        return await ruleInstanceService.getRuleInstanceStats(ruleInstanceId, {
          afterTimestamp,
          beforeTimestamp,
        })
      }
    )

    handlers.registerGetRulesWithAlerts(async () => {
      return await ruleInstanceService.getDistinctRuleInstanceIdsWithAlerts()
    })

    handlers.registerGetRuleInstanceRuleInstanceIdRecommendation(
      async (ctx, request) => {
        const { ruleInstanceId } = request
        const ruleThresholdOptimizer = new RuleThresholdOptimizer(tenantId, {
          dynamoDb,
          mongoDb,
        })
        return await ruleThresholdOptimizer.getRecommendedThresholdData(
          ruleInstanceId
        )
      }
    )

    handlers.registerPostRulesImport(async (ctx, request) => {
      const { file } = request.ImportConsoleDataRequest
      const s3 = getS3ClientByEvent(event)
      const { TMP_BUCKET, DOCUMENT_BUCKET } = process.env as {
        TMP_BUCKET: string
        DOCUMENT_BUCKET: string
      }
      const s3Service = new S3Service(s3, {
        tmpBucketName: TMP_BUCKET,
        documentBucketName: DOCUMENT_BUCKET,
      })
      const fileInfo = await s3Service.copyFilesToPermanentBucket([file])

      await sendBatchJobCommand({
        tenantId,
        type: 'FLAT_FILES_VALIDATION',
        parameters: {
          s3Key: fileInfo[0].s3Key,
          format: 'JSONL',
          schema: 'RULE_INSTANCES_IMPORT',
        },
      })
    })

    return await handlers.handle(event)
  }
)
