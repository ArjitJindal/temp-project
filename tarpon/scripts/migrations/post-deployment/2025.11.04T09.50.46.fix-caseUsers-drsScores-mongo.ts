import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClient, processCursorInBatch } from '@/utils/mongodb-utils'
import { CASES_COLLECTION } from '@/utils/mongo-table-names'
import { Case } from '@/@types/openapi-internal/Case'
import { Tenant } from '@/@types/tenant'
import { RiskRepository } from '@/services/risk-scoring/repositories/risk-repository'
import { getDynamoDbClient } from '@/utils/dynamodb'

async function migrateTenant(tenant: Tenant) {
  const tenantId = tenant.id
  const mongoDb = await getMongoDbClient()
  const dynamoDb = getDynamoDbClient()
  const casesCollection = mongoDb
    .db()
    .collection<Case>(CASES_COLLECTION(tenantId))
  const riskRepository = new RiskRepository(tenantId, { dynamoDb, mongoDb })

  const [corruptedOriginResult, corruptedDestinationResult] = await Promise.all(
    [
      casesCollection
        .aggregate([
          { $match: { 'caseUsers.originUserDrsScore': { $type: 'object' } } },
          { $count: 'total' },
        ])
        .toArray(),
      casesCollection
        .aggregate([
          {
            $match: {
              'caseUsers.destinationUserDrsScore': { $type: 'object' },
            },
          },
          { $count: 'total' },
        ])
        .toArray(),
    ]
  )

  const corruptedOrigin = corruptedOriginResult[0]?.total ?? 0
  const corruptedDestination = corruptedDestinationResult[0]?.total ?? 0

  console.log(
    `Tenant ${tenantId}: Found ${corruptedOrigin} cases with corrupted originUserDrsScore, ${corruptedDestination} cases with corrupted destinationUserDrsScore (total: ${
      corruptedOrigin + corruptedDestination
    })`
  )

  const casesCursor = casesCollection.aggregate<Case>([
    {
      $match: {
        caseUsers: { $exists: true },
        $or: [
          { 'caseUsers.originUserDrsScore': { $type: 'object' } },
          { 'caseUsers.destinationUserDrsScore': { $type: 'object' } },
        ],
      },
    },
  ])

  let processedCount = 0
  let updatedCount = 0

  await processCursorInBatch(
    casesCursor,
    async (batch) => {
      const userIds = new Set<string>()
      for (const case_ of batch) {
        if (case_.caseUsers?.origin?.userId) {
          userIds.add(case_.caseUsers.origin.userId)
        }
        if (case_.caseUsers?.destination?.userId) {
          userIds.add(case_.caseUsers.destination.userId)
        }
      }

      const drsScores = await riskRepository.getDrsScores(Array.from(userIds))
      const drsScoreMap = new Map<string, number>()
      for (const drs of drsScores) {
        if (drs.userId && drs.drsScore != null) {
          drsScoreMap.set(drs.userId, drs.drsScore)
        }
      }

      const bulkOps: Array<{
        updateOne: {
          filter: { caseId: string }
          update: Array<{ $set: Record<string, any> } | { $unset: string[] }>
        }
      }> = []

      for (const case_ of batch) {
        processedCount++
        const caseUsers = case_.caseUsers
        if (!caseUsers) {
          continue
        }

        const originUserId = caseUsers.origin?.userId
        const destinationUserId = caseUsers.destination?.userId

        const originDrsScore = originUserId
          ? drsScoreMap.get(originUserId)
          : undefined
        const destinationDrsScore = destinationUserId
          ? drsScoreMap.get(destinationUserId)
          : undefined

        const isUpdatingOrigin =
          caseUsers.origin != null && originDrsScore != null
        const isUpdatingDestination =
          caseUsers.origin == null && destinationDrsScore != null

        const drsScoreToUse = isUpdatingOrigin
          ? originDrsScore
          : isUpdatingDestination
          ? destinationDrsScore
          : undefined

        if (drsScoreToUse == null || !case_.caseId) {
          continue
        }

        const updatePipeline = [
          {
            $set: {
              ...(isUpdatingOrigin
                ? { 'caseUsers.originUserDrsScore': drsScoreToUse }
                : { 'caseUsers.destinationUserDrsScore': drsScoreToUse }),
            },
          },
          {
            $unset: isUpdatingOrigin
              ? ['caseUsers.destinationUserDrsScore']
              : ['caseUsers.originUserDrsScore'],
          },
        ]

        bulkOps.push({
          updateOne: {
            filter: { caseId: case_.caseId },
            update: updatePipeline,
          },
        })
      }

      if (bulkOps.length > 0) {
        await casesCollection.bulkWrite(bulkOps)
        updatedCount += bulkOps.length
      }

      if (updatedCount % 100 === 0) {
        console.log(
          `Tenant ${tenantId}: Processed ${processedCount} cases, updated ${updatedCount} cases`
        )
      }
    },
    {
      mongoBatchSize: 1000,
      processBatchSize: 200,
    }
  )

  console.log(
    `Migration completed for tenant ${tenantId}: Processed ${processedCount} cases, updated ${updatedCount} cases`
  )
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}

export const down = async () => {
  // No rollback needed
}
