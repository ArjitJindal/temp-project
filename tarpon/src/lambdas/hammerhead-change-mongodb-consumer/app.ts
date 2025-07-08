import { omit } from 'lodash'
import { getRiskLevelFromScore } from '@flagright/lib/utils'
import { DbClients } from '@/core/dynamodb/dynamodb-stream-consumer-builder'
import { ArsScore } from '@/@types/openapi-internal/ArsScore'
import { DrsScore } from '@/@types/openapi-internal/DrsScore'
import { KrsScore } from '@/@types/openapi-internal/KrsScore'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { isDemoTenant } from '@/utils/tenant'
import { MongoDbTransactionRepository } from '@/services/rules-engine/repositories/mongodb-transaction-repository'
import { AverageArsScore } from '@/@types/openapi-internal/AverageArsScore'
import { sendWebhookTasks } from '@/services/webhook/utils'
import { hasFeature } from '@/core/utils/context'
import { getRiskLevelForPNB } from '@/services/rules-engine/pnb-custom-logic'
import { User } from '@/@types/openapi-internal/User'
import { UserWithRulesResult } from '@/@types/openapi-internal/UserWithRulesResult'
import { mergeUserTags } from '@/services/rules-engine/utils'
import { UserType } from '@/@types/user/user-type'
import { addNewSubsegment } from '@/core/xray'
import { CaseRepository } from '@/services/cases/repository'
import { DYNAMO_KEYS } from '@/utils/dynamodb'

export async function arsScoreEventHandler(
  tenantId: string,
  arsScore: ArsScore | undefined,
  dbClients: DbClients
) {
  const transactionId = arsScore?.transactionId
  if (!arsScore || isDemoTenant(tenantId) || !transactionId) {
    return
  }
  const subSegment = await addNewSubsegment(
    'StreamConsumer',
    'arsScoreEventHandler'
  )
  const { mongoDb } = dbClients
  const riskRepository = new RiskRepository(tenantId, { mongoDb })

  const transactionRepository = new MongoDbTransactionRepository(
    tenantId,
    mongoDb,
    dbClients.dynamoDb
  )

  arsScore = omit(arsScore, DYNAMO_KEYS) as ArsScore

  await Promise.all([
    riskRepository.addArsValueToMongo(arsScore),
    transactionRepository.updateArsScore(transactionId, arsScore), // If transaction id does not exist, it will not result in an error
  ])
  subSegment?.close()
}

export async function drsScoreEventHandler(
  tenantId: string,
  oldDrsScore: DrsScore | undefined,
  newDrsScore: DrsScore | undefined,
  dbClients: DbClients
) {
  if (!newDrsScore) {
    return
  }
  const subSegment = await addNewSubsegment(
    'StreamConsumer',
    'drsScoreEventHandler'
  )
  const riskRepository = new RiskRepository(tenantId, dbClients)
  const userRepository = new UserRepository(tenantId, dbClients)
  const casesRepo = new CaseRepository(tenantId, dbClients)

  newDrsScore = omit(newDrsScore, DYNAMO_KEYS) as DrsScore

  if (newDrsScore.triggeredBy !== 'PUBLIC_API' && newDrsScore.userId) {
    const riskClassificationValues =
      await riskRepository.getRiskClassificationValues()

    const oldRiskLevel = getRiskLevelFromScore(
      riskClassificationValues,
      oldDrsScore?.drsScore ?? null
    )
    const newRiskLevel = getRiskLevelFromScore(
      riskClassificationValues,
      newDrsScore.drsScore
    )
    if (!oldDrsScore || oldRiskLevel !== newRiskLevel) {
      let riskLevel = newRiskLevel
      if (newDrsScore.userId && hasFeature('PNB')) {
        const user = await userRepository.getUser<
          UserWithRulesResult & { type: UserType }
        >(newDrsScore.userId)
        riskLevel = getRiskLevelForPNB(oldRiskLevel, newRiskLevel, user as User)
        const riskLevelStatus =
          riskLevel === 'HIGH' || riskLevel === 'VERY_HIGH'
            ? 'Incomplete'
            : 'Complete'
        if (
          user &&
          riskLevelStatus !==
            user.tags?.find((tag) => tag.key === 'RISK_LEVEL_STATUS')?.value
        ) {
          await userRepository.saveUser(
            {
              ...user,
              tags: mergeUserTags(user.tags, [
                {
                  isEditable: true,
                  value: riskLevelStatus,
                  key: 'RISK_LEVEL_STATUS',
                },
              ]),
            },
            user.type
          )
        }
      }
      await sendWebhookTasks(tenantId, [
        {
          event: 'CRA_RISK_LEVEL_UPDATED',
          entityId: newDrsScore.userId,
          payload: {
            riskLevel,
            userId: newDrsScore.userId,
          },
          triggeredBy:
            newDrsScore.triggeredBy === 'CONSOLE' ? 'MANUAL' : 'SYSTEM',
        },
      ])
    }
  }

  const caseIds = newDrsScore.userId
    ? await casesRepo.getCaseIdsByUserId(newDrsScore.userId)
    : []
  const caseIdStrings = caseIds
    .map((c) => c.caseId)
    .filter((id): id is string => id !== undefined)

  await Promise.all([
    riskRepository.addDrsValueToMongo(newDrsScore),
    newDrsScore.userId
      ? userRepository.updateDrsScoreOfUser(newDrsScore.userId, newDrsScore)
      : undefined,
    caseIdStrings.length > 0 && newDrsScore.userId
      ? casesRepo.updateCasesDrsScores(caseIdStrings, newDrsScore.drsScore)
      : undefined,
  ])
  subSegment?.close()
}

export async function krsScoreEventHandler(
  tenantId: string,
  krsScore: KrsScore | undefined,
  dbClients: DbClients
) {
  if (!krsScore || isDemoTenant(tenantId)) {
    return
  }
  const subSegment = await addNewSubsegment(
    'StreamConsumer',
    'krsScoreEventHandler'
  )
  const { mongoDb, dynamoDb } = dbClients

  const riskRepository = new RiskRepository(tenantId, { mongoDb, dynamoDb })
  const userRepository = new UserRepository(tenantId, { mongoDb, dynamoDb })
  krsScore = omit(krsScore, DYNAMO_KEYS) as KrsScore

  await Promise.all([
    riskRepository.addKrsValueToMongo(krsScore),
    krsScore.userId
      ? userRepository.updateKrsScoreOfUser(krsScore.userId, krsScore)
      : undefined,
  ])
  subSegment?.close()
}

export async function avgArsScoreEventHandler(
  tenantId: string,
  newAvgArs: AverageArsScore | undefined,
  dbClients: DbClients
) {
  if (!newAvgArs) {
    return
  }
  const subSegment = await addNewSubsegment(
    'StreamConsumer',
    'avgArsScoreEventHandler'
  )
  const { mongoDb } = dbClients

  const userRepository = new UserRepository(tenantId, { mongoDb })

  newAvgArs = omit(newAvgArs, DYNAMO_KEYS) as AverageArsScore

  await userRepository.updateAvgTrsScoreOfUser(
    newAvgArs.userId,
    omit(newAvgArs)
  )
  subSegment?.close()
}
