import { AnyBulkWriteOperation, Db } from 'mongodb'
import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts/repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import {
  CASES_COLLECTION,
  TRANSACTIONS_COLLECTION,
  SANCTIONS_WHITELIST_ENTITIES_COLLECTION,
} from '@/utils/mongodb-definitions'
import { Case } from '@/@types/openapi-public-management/Case'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { CounterRepository } from '@/services/counter/repository'
import { Alert } from '@/@types/openapi-internal/Alert'

async function backupCollection(db: Db, collectionName: string) {
  const backupCollectionName = `${collectionName}_backup`
  const batchSize = 1000 // Define a batch size

  try {
    const sourceCollection = db.collection(collectionName)
    const cursor = sourceCollection.find({})

    const count = await sourceCollection.countDocuments()
    if (count === 0) {
      console.log(`No documents to backup in ${collectionName}`)
      return { success: true, backupName: backupCollectionName, count: 0 }
    }

    const collections = await db
      .listCollections({ name: backupCollectionName })
      .toArray()
    if (collections.length > 0) {
      await db.dropCollection(backupCollectionName)
    }

    const backupCollection = db.collection(backupCollectionName)
    await db.createCollection(backupCollectionName)

    let batch: any[] = []
    let backedUpCount = 0

    for await (const doc of cursor) {
      batch.push(doc)
      if (batch.length === batchSize) {
        await backupCollection.insertMany(batch)
        backedUpCount += batch.length
        batch = [] // Clear the batch
      }
    }

    // Insert any remaining documents in the last batch
    if (batch.length > 0) {
      await backupCollection.insertMany(batch)
      backedUpCount += batch.length
    }

    console.log(
      `Backed up ${backedUpCount} documents from ${collectionName} to ${backupCollectionName}`
    )

    return {
      success: true,
      backupName: backupCollectionName,
      count: backedUpCount,
    }
  } catch (error) {
    console.error(`Error backing up collection ${collectionName}:`, error)
    return {
      success: false,
      backupName: backupCollectionName,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()
  const dynamoDb = getDynamoDbClient()
  const db = mongoDb.db()
  const tenantId = tenant.id
  const ruleRepository = new RuleInstanceRepository(tenantId, { dynamoDb })
  const ruleInstances = await ruleRepository.getAllRuleInstances()
  if (!ruleInstances.some((rule) => rule.ruleId === 'R-169')) {
    return
  }
  const casesCollection = db.collection<Case>(CASES_COLLECTION(tenantId))
  const sanctionsWhitelistCollection = db.collection(
    SANCTIONS_WHITELIST_ENTITIES_COLLECTION(tenantId)
  )

  try {
    // Backup each collection using the helper function
    const collectionsToBackup = [
      SANCTIONS_WHITELIST_ENTITIES_COLLECTION(tenantId),
    ]

    const backupResults = await Promise.all(
      collectionsToBackup.map((collectionName) =>
        backupCollection(db, collectionName)
      )
    )

    // Log summary of backup operations
    const successCount = backupResults.filter((result) => result.success).length
    const totalDocuments = backupResults.reduce(
      (sum, result) => sum + (result.count || 0),
      0
    )

    console.log(
      `Backup summary for tenant ${tenantId}: ${successCount}/${backupResults.length} collections backed up successfully with ${totalDocuments} total documents`
    )

    // If any backups failed, log errors
    const failedBackups = backupResults.filter((result) => !result.success)
    if (failedBackups.length > 0) {
      console.error(
        `Failed backups for tenant ${tenantId}:`,
        failedBackups
          .map((result) => `${result.backupName}: ${result.error}`)
          .join(', ')
      )
    }
  } catch (error) {
    console.error(`Error in backup process for tenant ${tenantId}:`, error)
  }

  const alertsPipeline = [
    {
      $match: {
        'alerts.ruleId': 'R-169',
      },
    },
    {
      $unwind: '$alerts',
    },
    {
      $match: {
        'alerts.ruleId': 'R-169',
      },
    },
    {
      $project: {
        _id: 0,
        alert: '$alerts',
      },
    },
  ]
  try {
    const result = await casesCollection
      .aggregate<{
        alert: Alert
      }>(alertsPipeline)
      .toArray()
    const alerts = result.map((item) => item.alert)
    const transactionsCollection = db.collection<InternalTransaction>(
      TRANSACTIONS_COLLECTION(tenantId)
    )
    const transactionIds = new Set<string>()
    for (const alert of alerts) {
      if (alert.transactionIds && Array.isArray(alert.transactionIds)) {
        for (const transactionId of alert.transactionIds) {
          transactionIds.add(transactionId)
        }
      }
    }
    const transactions = await transactionsCollection
      .find({
        transactionId: { $in: Array.from(transactionIds) },
      })
      .toArray()
    const transactionIdToPaymentMethodId = new Map<string | undefined, string>()

    for (const transaction of transactions) {
      // Find rule 169 in hitRules
      const rule169 = transaction.hitRules?.find(
        (rule) => rule.ruleId === 'R-169'
      )
      const hitDirection = rule169?.ruleHitMeta?.hitDirections?.[0]

      if (hitDirection) {
        const paymentMethodId =
          hitDirection !== 'ORIGIN'
            ? transaction.originPaymentMethodId
            : transaction.destinationPaymentMethodId

        if (paymentMethodId) {
          transactionIdToPaymentMethodId.set(
            transaction.transactionId,
            paymentMethodId
          )
        }
      }
    }

    const counterRepository = new CounterRepository(tenantId, mongoDb)
    const now = Date.now()
    const sanctionsWhitelistBulkOperations: AnyBulkWriteOperation<any>[] = []
    for (const alert of alerts) {
      if (!alert.ruleHitMeta?.sanctionsDetails) {
        continue
      }

      for (const sanctionsDetail of alert.ruleHitMeta.sanctionsDetails) {
        const context = sanctionsDetail.hitContext

        const alertTransactionIds = alert.transactionIds
        const reqTransactions = transactions.filter((transaction) =>
          alertTransactionIds?.includes(transaction.transactionId)
        )
        const transactionIds = reqTransactions
          .filter((transaction) =>
            transaction.hitRules?.some((rule) =>
              rule.ruleHitMeta?.sanctionsDetails?.find(
                (d) => d.searchId === sanctionsDetail.searchId
              )
            )
          )
          .map((t) => t.transactionId)

        const existingWhitelists = await sanctionsWhitelistCollection
          .find(
            {
              searchTerm: context?.searchTerm,
              userId: context?.userId,
              entity: 'EXTERNAL_USER',
              entityType: context?.entityType,
            },
            { projection: { _id: 0 } }
          )
          .toArray()

        if (existingWhitelists.length > 0 && transactionIds.length > 0) {
          const firstTransactionId = transactionIds[0]
          const firstPaymentMethodId =
            transactionIdToPaymentMethodId.get(firstTransactionId)

          for (const whitelist of existingWhitelists) {
            const updateFields: any = {}
            if (firstTransactionId) {
              updateFields.transactionId = firstTransactionId
            }
            if (firstPaymentMethodId) {
              updateFields.paymentMethodId = firstPaymentMethodId
            }
            if (Object.keys(updateFields).length > 0) {
              sanctionsWhitelistBulkOperations.push({
                updateOne: {
                  filter: {
                    sanctionsWhitelistId: whitelist.sanctionsWhitelistId,
                  },
                  update: {
                    $set: updateFields,
                    updatedAt: now,
                  },
                },
              })
            }
          }

          // For remaining transactions, create new copies of all whitelists
          const paymentIdsSet = new Set<string | null>()
          for (let i = 1; i < transactionIds.length; i++) {
            const transactionId = transactionIds[i]
            const paymentMethodId =
              transactionIdToPaymentMethodId.get(transactionId) ?? null

            if (!paymentIdsSet.has(paymentMethodId)) {
              for (const whitelist of existingWhitelists) {
                const newWhitelist = {
                  ...whitelist,
                  sanctionsWhitelistId:
                    'SW-' +
                    (await counterRepository.getNextCounterAndUpdate(
                      'SanctionsWhitelist'
                    )),
                  sanctionsEntity: {
                    ...whitelist.sanctionsEntity,
                  },
                  transactionId,
                  paymentMethodId,
                  createdAt: now,
                  updatedAt: now,
                }

                sanctionsWhitelistBulkOperations.push({
                  insertOne: {
                    document: newWhitelist,
                  },
                })
              }
              paymentIdsSet.add(paymentMethodId)
            }
          }
        }
      }
    }
    if (sanctionsWhitelistBulkOperations.length > 0) {
      await sanctionsWhitelistCollection.bulkWrite(
        sanctionsWhitelistBulkOperations
      )
    }
  } catch (error) {
    console.error('Error during migration:', error)
  }
}
export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
