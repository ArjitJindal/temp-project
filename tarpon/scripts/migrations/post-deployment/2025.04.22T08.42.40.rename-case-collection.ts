import crypto from 'crypto'
import { AnyBulkWriteOperation, Db } from 'mongodb'
import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts/repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient, processCursorInBatch } from '@/utils/mongodb-utils'
import {
  CASES_COLLECTION,
  TRANSACTIONS_COLLECTION,
  SANCTIONS_HITS_COLLECTION,
} from '@/utils/mongodb-definitions'
import { Case } from '@/@types/openapi-public-management/Case'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { CounterRepository } from '@/services/counter/repository'
import { SanctionsHit } from '@/@types/openapi-internal/SanctionsHit'
import { Alert } from '@/@types/openapi-internal/Alert'

async function getHash(subject: {
  userId?: string
  entityType?: string
  searchTerm?: string
  entity?: string
  paymentMethodId?: string | null
}) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(subject))
    .digest('hex')
}

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
  const sanctionsHitsCollection = db.collection<SanctionsHit>(
    SANCTIONS_HITS_COLLECTION(tenantId)
  )

  try {
    // Backup each collection using the helper function
    const collectionsToBackup = [
      CASES_COLLECTION(tenantId),
      SANCTIONS_HITS_COLLECTION(tenantId),
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
    const alertsCursor = casesCollection.aggregate<{
      alert: Alert
    }>(alertsPipeline)
    await processCursorInBatch(
      alertsCursor,
      async (result) => {
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
        const transactionIdToPaymentMethodId = new Map<
          string | undefined,
          string
        >()

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
        const sanctionsHitsBulkOperations: AnyBulkWriteOperation<any>[] = []
        const counterRepository = new CounterRepository(tenantId, {
          mongoDb,
          dynamoDb,
        })
        const hashSanctionHitIdsMap = new Map<string, string[]>()
        const now = Date.now()
        const paymentMethodIdSearchIdSet = new Set<string | null>()

        for (const alert of alerts) {
          if (
            alert.ruleHitMeta?.sanctionsDetails &&
            Array.isArray(alert.ruleHitMeta.sanctionsDetails)
          ) {
            const sanctionsDetails = alert.ruleHitMeta.sanctionsDetails
            for (const sanctionsDetail of sanctionsDetails) {
              const context = sanctionsDetail.hitContext
              const alertTransactionIds = alert.transactionIds

              const existingHits = await sanctionsHitsCollection
                .find({
                  sanctionsHitId: { $in: sanctionsDetail.sanctionHitIds },
                })
                .toArray()
              const reqTransactions = transactions.filter((transaction) =>
                alertTransactionIds?.includes(transaction.transactionId)
              )
              const filteredTransactions = reqTransactions.filter(
                (transaction) =>
                  transaction.hitRules?.some((rule) =>
                    rule.ruleHitMeta?.sanctionsDetails?.find(
                      (d) => d.searchId === sanctionsDetail.searchId
                    )
                  )
              )
              for (const transaction of filteredTransactions) {
                const paymentMethodId =
                  transactionIdToPaymentMethodId.get(
                    transaction.transactionId
                  ) ?? null
                if (
                  paymentMethodIdSearchIdSet.has(
                    paymentMethodId + ':' + sanctionsDetail.searchId
                  )
                ) {
                  continue
                }
                paymentMethodIdSearchIdSet.add(
                  paymentMethodId + ':' + sanctionsDetail.searchId
                )
                const setSanctionHitIds = new Set()
                for (const hit of existingHits) {
                  // If this hit belongs to any transaction with the same payment method ID
                  if (setSanctionHitIds.has(hit.sanctionsHitId)) {
                    continue
                  }
                  setSanctionHitIds.add(hit.sanctionsHitId)
                  const hitTransactionId = hit.hitContext?.transactionId
                  const hitPaymentMethodId =
                    transactionIdToPaymentMethodId.get(hitTransactionId)
                  if (hitPaymentMethodId === paymentMethodId) {
                    sanctionsHitsBulkOperations.push({
                      updateOne: {
                        filter: {
                          sanctionsHitId: hit.sanctionsHitId,
                        },
                        update: {
                          $set: {
                            'hitContext.paymentMethodId': paymentMethodId,
                          },
                        },
                      },
                    })
                  } else {
                    const hash = await getHash({
                      userId: context?.userId,
                      entityType: context?.entityType,
                      searchTerm: context?.searchTerm,
                      entity: context?.entity,
                      paymentMethodId: paymentMethodId,
                    })
                    const sanctionHitId =
                      'SH-' +
                      (await counterRepository.getNextCounterAndUpdate(
                        'SanctionsHit'
                      ))
                    hashSanctionHitIdsMap.set(hash, [
                      ...(hashSanctionHitIdsMap.get(hash) ?? []),
                      sanctionHitId,
                    ])
                    const { _id, ...hitWithoutId } = hit
                    sanctionsHitsBulkOperations.push({
                      insertOne: {
                        document: {
                          ...hitWithoutId,
                          searchId: sanctionsDetail.searchId,
                          sanctionsHitId: sanctionHitId,
                          hitContext: {
                            ...hitWithoutId.hitContext,
                            transactionId: transaction.transactionId,
                            paymentMethodId: paymentMethodId,
                          },
                          updatedAt: now,
                          createdAt: now,
                        },
                      },
                    })
                  }
                }
              }
            }
          }
        }
        if (sanctionsHitsBulkOperations.length > 0) {
          await sanctionsHitsCollection.bulkWrite(sanctionsHitsBulkOperations)
          console.log(
            `Updated ${sanctionsHitsBulkOperations.length} sanctions hits with paymentMethodId`
          )
        } else {
          console.log('No matching sanctions hits found to update')
        }

        const alertBulkOperations: AnyBulkWriteOperation<Case>[] = []
        for (const alert of alerts) {
          const sanctionDetails = alert.ruleHitMeta?.sanctionsDetails
          if (!sanctionDetails) {
            continue
          }
          for (const sanctionsDetail of sanctionDetails) {
            const context = sanctionsDetail.hitContext
            const paymentMethodId = transactionIdToPaymentMethodId.get(
              context?.transactionId
            )
            const hash = await getHash({
              userId: context?.userId,
              entityType: context?.entityType,
              searchTerm: context?.searchTerm,
              entity: context?.entity,
              paymentMethodId: paymentMethodId ?? null,
            })
            const sanctionHitIds = hashSanctionHitIdsMap.get(hash) || []
            const existingHitIds = sanctionsDetail.sanctionHitIds || []
            alertBulkOperations.push({
              updateOne: {
                filter: {
                  'alerts.alertId': alert.alertId,
                },
                update: {
                  $set: {
                    'alerts.$[alertElem].ruleHitMeta.sanctionsDetails.$[detailElem].sanctionHitIds':
                      [...existingHitIds, ...sanctionHitIds],
                    'alerts.$[alertElem].ruleHitMeta.sanctionsDetails.$[detailElem].hitContext.paymentMethodId':
                      paymentMethodId ?? null,
                  },
                },
                arrayFilters: [
                  { 'alertElem.alertId': alert.alertId },
                  {
                    'detailElem.hitContext.transactionId':
                      context?.transactionId,
                  },
                ],
              },
            })
          }
        }

        if (alertBulkOperations.length > 0) {
          await casesCollection.bulkWrite(alertBulkOperations)
        }
      },
      {
        mongoBatchSize: 500,
        processBatchSize: 100,
      }
    )
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
