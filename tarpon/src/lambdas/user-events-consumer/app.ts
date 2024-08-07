import { SQSEvent, SQSRecord } from 'aws-lambda'
import { difference, isEqual, omit, pick } from 'lodash'
import {
  SendMessageCommand,
  SendMessageCommandInput,
} from '@aws-sdk/client-sqs'
import { lambdaConsumer } from '@/core/middlewares/lambda-consumer-middlewares'
import {
  initializeTenantContext,
  tenantHasFeature,
  tenantSettings,
  updateLogMetadata,
  withContext,
} from '@/core/utils/context'
import { logger } from '@/core/logger'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { CaseRepository } from '@/services/cases/repository'
import { DYNAMO_KEYS } from '@/core/seed/dynamodb'
import { CaseCreationService } from '@/services/cases/case-creation-service'
import { getSQSClient } from '@/utils/sns-sqs-client'
import { envIs } from '@/utils/env'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { UserWithRulesResult } from '@/@types/openapi-public/UserWithRulesResult'
import { BusinessWithRulesResult } from '@/@types/openapi-internal/BusinessWithRulesResult'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { isDemoTenant } from '@/utils/tenant'
import { sendBatchJobCommand } from '@/services/batch-jobs/batch-job'

export const INTERNAL_ONLY_USER_ATTRIBUTES = difference(
  InternalUser.getAttributeTypeMap().map((v) => v.name),
  UserWithRulesResult.getAttributeTypeMap().map((v) => v.name)
)

interface UserEventTask {
  tenantId: string
  oldUser: BusinessWithRulesResult | UserWithRulesResult | undefined
  newUser: BusinessWithRulesResult | UserWithRulesResult | undefined
}

export const userEventsHandler = lambdaConsumer()(async (event: SQSEvent) => {
  await Promise.all(
    event.Records.map((record: SQSRecord) => {
      return withContext(async () => {
        const task: UserEventTask = JSON.parse(record.body)
        await initializeTenantContext(task.tenantId)
        const { tenantId, oldUser, newUser } = task
        await userHandler(tenantId, oldUser, newUser)
      })
    })
  )
})

export async function sendUserEvent({
  tenantId,
  oldUser,
  newUser,
}: {
  tenantId: string
  oldUser: BusinessWithRulesResult | UserWithRulesResult | undefined
  newUser: BusinessWithRulesResult | UserWithRulesResult | undefined
}) {
  const tenantHasFeatureKinesisAsync = await tenantHasFeature(
    tenantId,
    'KINESIS_ASYNC'
  )
  if (envIs('local', 'test') || !tenantHasFeatureKinesisAsync) {
    await userHandler(tenantId, oldUser, newUser)
  } else {
    const params: SendMessageCommandInput = {
      MessageBody: JSON.stringify({
        tenantId,
        oldUser,
        newUser,
      }),
      QueueUrl: process.env.USER_EVENT_QUEUE_URL ?? '',
      MessageGroupId: tenantId,
      MessageDeduplicationId: newUser?.userId,
    }
    const sqsClient = getSQSClient()
    await sqsClient.send(new SendMessageCommand(params))
  }
}

async function userHandler(
  tenantId: string,
  oldUser: BusinessWithRulesResult | UserWithRulesResult | undefined,
  newUser: BusinessWithRulesResult | UserWithRulesResult | undefined
) {
  if (!newUser || !newUser.userId) {
    return
  }
  updateLogMetadata({ userId: newUser.userId })

  logger.info(`Processing User`)

  let internalUser = newUser as InternalUser
  const mongoDb = await getMongoDbClient()
  const dynamoDb = getDynamoDbClient()
  const casesRepo = new CaseRepository(tenantId, {
    mongoDb,
    dynamoDb,
  })

  const usersRepo = new UserRepository(tenantId, { mongoDb, dynamoDb })

  const settings = await tenantSettings(tenantId)

  const caseCreationService = new CaseCreationService(tenantId, {
    mongoDb,
    dynamoDb,
  })

  const riskRepository = new RiskRepository(tenantId, { dynamoDb })
  const isRiskScoringEnabled = settings?.features?.includes('RISK_SCORING')

  const isRiskLevelsEnabled = settings?.features?.includes('RISK_LEVELS')

  const [krsScore, drsScore] = await Promise.all([
    isRiskScoringEnabled
      ? riskRepository.getKrsScore(internalUser.userId)
      : null,
    isRiskScoringEnabled || isRiskLevelsEnabled
      ? riskRepository.getDrsScore(internalUser.userId)
      : null,
  ])

  if (!krsScore && isRiskScoringEnabled) {
    logger.warn(
      `KRS score not found for user ${internalUser.userId} for tenant ${tenantId}`
    )
  }

  internalUser = {
    ...internalUser,
    ...(krsScore && { krsScore }),
    ...(drsScore && { drsScore }),
  }

  const [_, existingUser] = await Promise.all([
    drsScore && isRiskScoringEnabled
      ? usersRepo.updateDrsScoreOfUser(internalUser.userId, drsScore)
      : null,
    usersRepo.getUserById(internalUser.userId),
  ])

  internalUser.createdAt = existingUser?.createdAt ?? Date.now()
  internalUser.updatedAt = Date.now()

  const savedUser = await usersRepo.saveUserMongo({
    ...pick(existingUser, INTERNAL_ONLY_USER_ATTRIBUTES),
    ...(omit(internalUser, DYNAMO_KEYS) as InternalUser),
  })

  const newHitRules = savedUser.hitRules?.filter(
    (hitRule) => !hitRule.ruleHitMeta?.isOngoingScreeningHit
  )
  // NOTE: This is a workaround to avoid creating redundant cases. In 748200a, we update
  // user.riskLevel in DynamoDB, but if a case was created for rule A and was closed, updating user.riskLevel
  // alone will trigger a new case which is unexpected. We only want to create a new case if the user details
  // have changes (when there're changes, we'll run user rules again).
  const userDetailsChanged = !isEqual(
    omit(oldUser, 'riskLevel'),
    omit(newUser, 'riskLevel')
  )
  if (userDetailsChanged && newHitRules?.length) {
    const timestampBeforeCasesCreation = Date.now()
    const cases = await caseCreationService.handleUser({
      ...savedUser,
      hitRules: newHitRules,
    })
    await caseCreationService.handleNewCases(
      tenantId,
      timestampBeforeCasesCreation,
      cases
    )
  }
  await casesRepo.syncCaseUsers(internalUser)

  if (!krsScore && isRiskScoringEnabled && !isDemoTenant(tenantId)) {
    // Will backfill KRS score for all users without KRS score
    await sendBatchJobCommand({
      type: 'PULSE_USERS_BACKFILL_RISK_SCORE',
      tenantId,
    })
  }
}
