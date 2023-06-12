import { StackConstants } from '@lib/constants'
import _ from 'lodash'
import { BatchWriteCommand } from '@aws-sdk/lib-dynamodb'
import { migrateAllTenants } from '../utils/tenant'
import {
  getMigrationLastCompletedTimestamp,
  updateMigrationLastCompletedTimestamp,
} from '../utils/migration-progress'
import { migrateEntities } from '../utils/mongodb'
import {
  ARS_SCORES_COLLECTION,
  USERS_COLLECTION,
  getMongoDbClient,
} from '@/utils/mongoDBUtils'
import { Tenant } from '@/services/accounts'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { logger } from '@/core/logger'
import { ArsScore } from '@/@types/openapi-internal/ArsScore'
import { DrsScore } from '@/@types/openapi-internal/DrsScore'
import { DynamoDbKeys } from '@/core/dynamodb/dynamodb-keys'

const allowedTenants: Record<string, string[]> = {
  local: ['flagright'],
  dev: ['flagright'],
  sandbox: ['flagright'],
  prod: ['G7ZN1UYR9V', 'FT398YYJMD', '4PKTHPN204', '85J6QJ28BY', 'flagright'],
}

async function migrateTenant(tenant: Tenant) {
  const env = process.env.ENV?.startsWith('prod')
    ? 'prod'
    : process.env.ENV || ''

  if (!allowedTenants[env]?.includes(tenant.id)) {
    console.log(`Skipping tenant ${tenant.id}, ${tenant.name}`)
    return
  }

  const usersCollectionName = USERS_COLLECTION(tenant.id)

  const mongoDb = await getMongoDbClient()
  const dynamoDb = getDynamoDbClient()

  const db = mongoDb.db()

  const usersCollection = db.collection<InternalUser>(usersCollectionName)

  const migrationKey = `2023.06.07T22.33.36.drs-score-fix.ts-${tenant.id}`

  const lastCompletedTimestamp = await getMigrationLastCompletedTimestamp(
    migrationKey
  )

  const usersCountToMigrate = await usersCollection.countDocuments({
    createdTimestamp: { $gt: lastCompletedTimestamp ?? 0 },
  })

  if (usersCountToMigrate === 0) {
    logger.info(`No users to migrate for tenant ${tenant.id}, ${tenant.name}`)
    return
  }

  const totalUsersBatches = Math.ceil(usersCountToMigrate / 25)

  logger.info(
    `Migrating ${usersCountToMigrate} users for tenant ${tenant.id}, ${tenant.name} in ${totalUsersBatches} batches`
  )

  const cursor = usersCollection
    .find({
      createdTimestamp: { $gt: lastCompletedTimestamp ?? 0 },
    })
    .sort({ createdTimestamp: 1 })

  let totalUsersProcessed = 0

  await migrateEntities<InternalUser>(
    cursor,
    async (usersBatch) => {
      const drsScores = await Promise.all(
        usersBatch.map(
          async (user) => await calculateDrsScore(tenant, user as InternalUser)
        )
      )

      const batchWriteRequests: AWS.DynamoDB.DocumentClient.WriteRequest[] =
        _.compact(drsScores).map((drsScore) => getDrsObject(tenant, drsScore))

      const batchWrite: AWS.DynamoDB.DocumentClient.BatchWriteItemInput = {
        RequestItems: {
          [StackConstants.HAMMERHEAD_DYNAMODB_TABLE_NAME]: batchWriteRequests,
        },
      }

      await dynamoDb.send(new BatchWriteCommand(batchWrite))

      await updateMigrationLastCompletedTimestamp(
        migrationKey,
        _.last(usersBatch)?.createdTimestamp ?? 0
      )

      totalUsersProcessed += usersBatch.length

      console.log(
        `Processed ${totalUsersProcessed} of ${usersCountToMigrate} users for tenant ${tenant.id}, ${tenant.name}`
      )
    },
    { processBatchSize: 25, mongoBatchSize: 1000 }
  )
}

type calculateDrsScoreResult = {
  drsScore: number
  user: InternalUser
}

const getDrsObject = (
  tenant: Tenant,
  drsData: calculateDrsScoreResult
): AWS.DynamoDB.DocumentClient.WriteRequest => {
  const isDrsUpdatable = drsData?.user?.drsScore?.isUpdatable ?? true

  if (isDrsUpdatable === false) {
    logger.info(
      `Drs score for user ${drsData.user.userId} is not updatable, will not update`
    )
  }

  const newDrsScoreItem: DrsScore & { isNew: boolean } = {
    drsScore:
      isDrsUpdatable === false && drsData?.user?.drsScore?.drsScore != null
        ? drsData.user?.drsScore?.drsScore
        : drsData.drsScore,
    transactionId: drsData?.user?.drsScore?.transactionId ?? 'SCRIPT_MIGRATION',
    createdAt: Date.now(),
    isUpdatable: isDrsUpdatable,
    userId: drsData.user.userId,
    components: drsData.user?.drsScore?.components ?? [],
    isNew: true,
  }

  const primaryKey = DynamoDbKeys.DRS_VALUE_ITEM(
    tenant.id,
    drsData.user.userId,
    '1'
  )

  return {
    PutRequest: {
      Item: {
        ...primaryKey,
        ...newDrsScoreItem,
      },
    },
  }
}

const calculateDrsScore = async (
  tenant: Tenant,
  user: InternalUser
): Promise<calculateDrsScoreResult | undefined> => {
  const { krsScore, userId } = user

  const mongoDb = await getMongoDbClient()
  const db = mongoDb.db()

  if (krsScore?.krsScore == null) {
    logger.info(
      `User ${userId} has no krsScore, skipping DRS score calculation`
    )
    return
  }

  const arsScoresCollection = db.collection<ArsScore>(
    ARS_SCORES_COLLECTION(tenant.id)
  )

  const arsScores = await arsScoresCollection
    .find({
      $or: [{ originUserId: userId }, { destinationUserId: userId }],
    })
    .sort({ _id: 1 })

  console.log(`Found ${await arsScores.count()} ars scores for user ${userId}`)

  let drsScore = krsScore.krsScore

  for await (const arsScore of arsScores) {
    drsScore = (drsScore + arsScore.arsScore) / 2
  }

  return {
    drsScore,
    user,
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}

export const down = async () => {
  // skip
}
