import { Credentials } from '@aws-sdk/client-sts'
import {
  APIGatewayEventLambdaAuthorizerContext,
  APIGatewayProxyWithLambdaAuthorizerEvent,
} from 'aws-lambda'
import { NotFound } from 'http-errors'
import { logger } from '@/core/logger'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { getDynamoDbClientByEvent } from '@/utils/dynamodb'
import { lambdaApi } from '@/core/middlewares/lambda-api-middlewares'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { User } from '@/@types/openapi-public/User'
import { Business } from '@/@types/openapi-public/Business'
import { RiskScoringService } from '@/services/risk-scoring'
import { hasFeature, updateLogMetadata } from '@/core/utils/context'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { UserManagementService } from '@/services/users'
import { pickKnownEntityFields } from '@/utils/object'
import {
  getRiskLevelFromScore,
  getRiskScoreFromLevel,
} from '@/services/risk-scoring/utils'
import { RiskLevel } from '@/@types/openapi-internal/RiskLevel'
import { ConsumerUsersResponse } from '@/@types/openapi-public/ConsumerUsersResponse'

export const userHandler = lambdaApi()(
  async (
    event: APIGatewayProxyWithLambdaAuthorizerEvent<
      APIGatewayEventLambdaAuthorizerContext<Credentials>
    >
  ) => {
    const { principalId: tenantId } = event.requestContext.authorizer
    const dynamoDb = getDynamoDbClientByEvent(event)
    const mongoDb = await getMongoDbClient()
    const userRepository = new UserRepository(tenantId, {
      dynamoDb: dynamoDb,
      mongoDb,
    })
    const userId = event.pathParameters?.userId
    const isConsumerUser = event.path.includes('consumer')

    if (event.httpMethod === 'GET' && userId) {
      const user = isConsumerUser
        ? await userRepository.getConsumerUserWithRiskScores(userId)
        : await userRepository.getBusinessUserWithRiskScores(userId)

      if (!user) {
        throw new NotFound(`User ${userId} not found`)
      }

      return user
    } else if (event.httpMethod === 'POST' && event.body) {
      const userPayload = pickKnownEntityFields(
        JSON.parse(event.body),
        isConsumerUser ? User : Business
      ) as User | Business

      updateLogMetadata({ userId: userPayload.userId })
      logger.info(`Processing User`) // Need to log to show on the logs

      if (userPayload.userId) {
        const user = isConsumerUser
          ? await userRepository.getConsumerUserWithRiskScores(
              userPayload.userId as string
            )
          : await userRepository.getBusinessUserWithRiskScores(
              userPayload.userId as string
            )

        if (user) {
          return {
            userId: user.userId,
            message:
              'The provided userId already exists. The user attribute updates are not saved. If you want to update the attributes of this user, please use user events instead.',
            riskScoreDetails: user.riskScoreDetails,
          }
        }
      }

      let krsScore: number | undefined
      let craScore: number | undefined
      let krsRiskLevel: RiskLevel | undefined
      let craRiskLevel: RiskLevel | undefined

      if (hasFeature('RISK_LEVELS') || hasFeature('RISK_SCORING')) {
        const riskScoringService = new RiskScoringService(tenantId, {
          dynamoDb,
          mongoDb,
        })
        const riskRepository = new RiskRepository(tenantId, {
          dynamoDb,
          mongoDb,
        })

        const riskClassificationValues =
          await riskRepository.getRiskClassificationValues()

        if (hasFeature('RISK_SCORING')) {
          const score = await riskScoringService.updateInitialRiskScores(
            userPayload as User | Business
          )

          krsScore = craScore = score

          const riskLevel = getRiskLevelFromScore(
            riskClassificationValues,
            score
          )

          krsRiskLevel = craRiskLevel = riskLevel
        }

        const preDefinedRiskLevel = userPayload.riskLevel

        if (preDefinedRiskLevel) {
          await riskScoringService.handleManualRiskLevel(
            userPayload as User | Business
          )

          craScore = getRiskScoreFromLevel(
            riskClassificationValues,
            preDefinedRiskLevel
          )

          craRiskLevel = preDefinedRiskLevel
        }
      }

      const userManagementService = new UserManagementService(
        tenantId,
        dynamoDb,
        mongoDb
      )

      const user = await userManagementService.verifyUser(
        userPayload,
        isConsumerUser ? 'CONSUMER' : 'BUSINESS'
      )

      return {
        userId: user.userId,
        ...((krsScore || craScore) && {
          riskScoreDetails: {
            ...(krsRiskLevel && {
              kycRiskLevel: krsRiskLevel,
              kycRiskScore: krsScore,
            }),
            ...(craRiskLevel && {
              craRiskLevel: craRiskLevel,
              craRiskScore: craScore,
            }),
          },
        }),
      } as ConsumerUsersResponse
    }
    return 'Unhandled request'
  }
)
