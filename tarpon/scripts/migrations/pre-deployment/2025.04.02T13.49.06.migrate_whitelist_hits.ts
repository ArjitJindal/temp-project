import { AnyBulkWriteOperation } from 'mongodb'
import { migrateAllTenants } from '../utils/tenant'
import { Tenant } from '@/services/accounts/repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import {
  CASES_COLLECTION,
  TRANSACTIONS_COLLECTION,
  SANCTIONS_HITS_COLLECTION,
  SANCTIONS_WHITELIST_ENTITIES_COLLECTION,
} from '@/utils/mongodb-definitions'
import { Case } from '@/@types/openapi-public-management/Case'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { RuleInstanceRepository } from '@/services/rules-engine/repositories/rule-instance-repository'
import { CounterRepository } from '@/services/counter/repository'

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
  const sanctionsHitsCollection = db.collection(
    SANCTIONS_HITS_COLLECTION(tenantId)
  )
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
      $unwind: '$alerts.ruleHitMeta.sanctionsDetails',
    },
    {
      $match: {
        'alerts.ruleHitMeta.sanctionsDetails.hitContext': { $exists: true },
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
    const result = await casesCollection.aggregate(alertsPipeline).toArray()
    const alerts = result.map((item) => item.alert)
    const alertIds = Array.from(new Set(alerts.map((item) => item.alertId)))
    const transactionsCollection = db.collection<InternalTransaction>(
      TRANSACTIONS_COLLECTION(tenantId)
    )
    const transactions = await transactionsCollection
      .find({
        alertIds: { $in: alertIds },
      })
      .toArray()

    const transactionIdToPaymentMethodId = new Map<string, string>()

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

    // Now update the sanctions-hits collection
    const sanctionsHitsBulkOperations: AnyBulkWriteOperation<any>[] = []
    const counterRepository = new CounterRepository(tenantId, mongoDb)
    const paymentMethodIdSanctionHitIdsMap = new Map<string, string[]>()

    for (const alert of alerts) {
      const context = alert.ruleHitMeta.sanctionsDetails.hitContext
      const transactionIds = alert.transactionIds || []

      // First, find all existing hits for this rule and search term
      const existingHits = await sanctionsHitsCollection
        .find(
          {
            'hitContext.ruleInstanceId': context.ruleInstanceId,
            'hitContext.searchTerm': context.searchTerm,
            'hitContext.userId': context.userId,
          },
          { projection: { _id: 0 } }
        )
        .toArray()

      // For each existing hit
      for (const hit of existingHits) {
        // For each transaction
        for (const transactionId of transactionIds) {
          const paymentMethodId =
            transactionIdToPaymentMethodId.get(transactionId)

          if (paymentMethodId) {
            // If this hit already has this transactionId, just update the paymentMethodId
            if (hit.hitContext.transactionId === transactionId) {
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
              // Otherwise create a new hit with this transactionId
              const sanctionHitId =
                'SH-' +
                (await counterRepository.getNextCounterAndUpdate(
                  'SanctionsHit'
                ))
              const existingHitIds =
                paymentMethodIdSanctionHitIdsMap.get(paymentMethodId) || []
              paymentMethodIdSanctionHitIdsMap.set(paymentMethodId, [
                ...existingHitIds,
                sanctionHitId,
              ])
              sanctionsHitsBulkOperations.push({
                insertOne: {
                  document: {
                    ...hit,
                    sanctionsHitId: sanctionHitId,
                    hitContext: {
                      ...hit.hitContext,
                      transactionId: transactionId,
                      paymentMethodId: paymentMethodId,
                    },
                  },
                },
              })
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

    const sanctionsWhitelistBulkOperations: AnyBulkWriteOperation<any>[] = []
    for (const alert of alerts) {
      const context = alert.ruleHitMeta.sanctionsDetails.hitContext
      const transactionIds = alert.transactionIds || []

      const existingWhitelists = await sanctionsWhitelistCollection
        .find(
          {
            searchTerm: context.searchTerm,
            userId: context.userId,
            entity: 'EXTERNAL_USER',
            entityType: context.entityType,
          },
          { projection: { _id: 0 } }
        )
        .toArray()

      if (existingWhitelists.length > 0 && transactionIds.length > 0) {
        // For the first transaction, update existing whitelists
        const firstTransactionId = transactionIds[0]
        const firstPaymentMethodId =
          transactionIdToPaymentMethodId.get(firstTransactionId)

        if (firstPaymentMethodId) {
          for (const whitelist of existingWhitelists) {
            sanctionsWhitelistBulkOperations.push({
              updateOne: {
                filter: {
                  sanctionsWhitelistId: whitelist.sanctionsWhitelistId,
                },
                update: {
                  $set: {
                    transactionId: firstTransactionId,
                    paymentMethodId: firstPaymentMethodId,
                  },
                },
              },
            })
          }
        }

        // For remaining transactions, create new copies of all whitelists
        const paymentIdsSet = new Set<string>()
        for (let i = 1; i < transactionIds.length; i++) {
          const transactionId = transactionIds[i]
          const paymentMethodId =
            transactionIdToPaymentMethodId.get(transactionId)

          if (paymentMethodId && !paymentIdsSet.has(paymentMethodId)) {
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
                createdAt: Date.now(),
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

    if (sanctionsWhitelistBulkOperations.length > 0) {
      await sanctionsWhitelistCollection.bulkWrite(
        sanctionsWhitelistBulkOperations
      )
      console.log(
        `Processed ${sanctionsWhitelistBulkOperations.length} sanctions whitelist operations`
      )
    } else {
      console.log('No matching sanctions whitelist entities found to process')
    }

    const alertBulkOperations: AnyBulkWriteOperation<Case>[] = []
    for (const alert of alerts) {
      const transactionIds = alert.transactionIds || []

      alertBulkOperations.push({
        updateOne: {
          filter: {
            'alerts.alertId': alert.alertId,
          },
          update: {
            $pull: {
              'alerts.$[alertElem].ruleHitMeta.sanctionsDetails': {
                'hitContext.paymentMethodId': { $exists: false },
              },
            },
          },
          arrayFilters: [{ 'alertElem.alertId': alert.alertId }],
        },
      })
      const paymentIdsSet = new Set<string>()
      for (const transactionId of transactionIds) {
        const paymentMethodId =
          transactionIdToPaymentMethodId.get(transactionId)

        if (paymentMethodId && !paymentIdsSet.has(paymentMethodId)) {
          const hits =
            paymentMethodIdSanctionHitIdsMap.get(paymentMethodId) || []
          alertBulkOperations.push({
            updateOne: {
              filter: {
                'alerts.alertId': alert.alertId,
              },
              update: {
                $push: {
                  'alerts.$[alertElem].ruleHitMeta.sanctionsDetails': {
                    ...alert.ruleHitMeta.sanctionsDetails,
                    sanctionHitIds: hits.length
                      ? hits
                      : alert.ruleHitMeta.sanctionsDetails.sanctionHitIds,
                    hitContext: {
                      ...alert.ruleHitMeta.sanctionsDetails.hitContext,
                      transactionId: transactionId,
                      paymentMethodId: paymentMethodId,
                    },
                  },
                },
              },
              arrayFilters: [{ 'alertElem.alertId': alert.alertId }],
            },
          })
          paymentIdsSet.add(paymentMethodId)
        }
      }
    }

    if (alertBulkOperations.length > 0) {
      await casesCollection.bulkWrite(alertBulkOperations)
      console.log(
        'Bulk update completed for alerts with paymentMethodId in hitContext count:',
        alertBulkOperations.length
      )
    } else {
      console.log('No updates required for alerts')
    }
  } catch (error) {
    console.error('Error executing aggregation pipeline:', error)
  }
}
export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
