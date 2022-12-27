import _ from 'lodash'
import { migrateAllTenants } from '../utils/tenant'
import { tenantHasFeature } from '@/core/middlewares/tenant-has-feature'
import { Tenant } from '@/lambdas/console-api-account/services/accounts-service'
import {
  CASES_COLLECTION,
  DRS_SCORES_COLLECTION,
  getMongoDbClient,
} from '@/utils/mongoDBUtils'
import { Case } from '@/@types/openapi-internal/Case'
import { DrsScore } from '@/@types/openapi-internal/DrsScore'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'

async function migrateTenant(tenant: Tenant) {
  if (!tenantHasFeature(tenant.id, 'PULSE')) {
    return
  }

  console.log(`Migrating tenant ${tenant.id}`)

  const mongoDb = await getMongoDbClient()
  const dynamoDb = await getDynamoDbClient()
  const casesCollectionName = CASES_COLLECTION(tenant.id)
  const dynamicRiskScoresCollectionName = DRS_SCORES_COLLECTION(tenant.id)
  const db = mongoDb.db()
  const casesCollection = db.collection<Case>(casesCollectionName)

  const cases = await casesCollection.find({}).toArray()

  const riskRepository = new RiskRepository(tenant.id, { dynamoDb })

  for await (const case_ of cases) {
    const { caseTransactionsIds } = case_

    if (!caseTransactionsIds?.length) {
      continue
    }

    const dynamicRiskScores: any = await db
      .collection<DrsScore>(dynamicRiskScoresCollectionName)
      .aggregate([
        {
          $match: {
            transactionId: { $in: caseTransactionsIds },
          },
        },
        {
          $group: {
            _id: {
              transactionId: '$transactionId',
              userId: '$userId',
            },
            drsScore: { $first: '$drsScore' },
          },
        },
        {
          $group: {
            _id: '$_id.transactionId',
            drsScores: {
              $push: {
                userId: '$_id.userId',
                drsScore: '$drsScore',
              },
            },
          },
        },
      ])
      .next()

    console.log(`Migrating case ${case_.caseId}`)
    let originUserDrsScore = null
    let destinationUserDrsScore = null

    const originUserId = case_?.caseUsers?.origin?.userId
    const destinationUserId = case_?.caseUsers?.destination?.userId

    if (dynamicRiskScores?.drsScores?.length) {
      originUserDrsScore = dynamicRiskScores?.drsScores?.find(
        (drsScore: any) => drsScore.userId === originUserId
      )?.drsScore

      destinationUserDrsScore = dynamicRiskScores?.drsScores?.find(
        (drsScore: any) => drsScore.userId === destinationUserId
      )?.drsScore
    } else {
      if (originUserId) {
        originUserDrsScore = (await riskRepository.getDrsScore(originUserId))
          ?.drsScore
      }

      if (destinationUserId) {
        destinationUserDrsScore = (
          await riskRepository.getDrsScore(destinationUserId)
        )?.drsScore
      }
    }

    await casesCollection.updateOne(
      { caseId: case_.caseId },
      {
        $set: {
          'caseUsers.originUserDrsScore': originUserDrsScore,
          'caseUsers.destinationUserDrsScore': destinationUserDrsScore,
        },
      }
    )

    console.log(`Migrated case ${case_.caseId}`)
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
