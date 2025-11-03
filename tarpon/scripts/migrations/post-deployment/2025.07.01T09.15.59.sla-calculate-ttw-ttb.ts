import pMap from 'p-map'
import { AggregationCursor, MongoClient } from 'mongodb'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { migrateAllTenants } from '../utils/tenant'
import { getMongoDbClient, processCursorInBatch } from '@/utils/mongodb-utils'
import { Tenant } from '@/@types/tenant'
import { Case } from '@/@types/openapi-internal/Case'
import { CASES_COLLECTION } from '@/utils/mongo-table-names'
import { Alert } from '@/@types/openapi-internal/Alert'
import { logger } from '@/core/logger'
import { SLAPolicyDetails } from '@/@types/openapi-internal/SLAPolicyDetails'
import {
  calculateSLATimeWindowsForPolicy,
  getSLAStatusFromElapsedTime,
} from '@/services/sla/sla-utils'
import { SLAPolicyService } from '@/services/tenants/sla-policy-service'
import { AlertsRepository } from '@/services/alerts/repository'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { SlaUpdates } from '@/services/sla/sla-service'
import { CaseRepository } from '@/services/cases/repository'
import { hasFeature } from '@/core/utils/context'
import { getDerivedStatus } from '@/services/cases/utils'

const CONCURRENCY = 50
const BATCH_SIZE = 10000

const calculateTimeToWarningAndBreach = async <T extends Alert | Case>(
  type: 'alert' | 'case',
  cursor: AggregationCursor<T>,
  connections: {
    mongoDb: MongoClient
    dynamoDb: DynamoDBClient
  },
  tenantId: string,
  updateEntity: (updates: SlaUpdates[]) => Promise<void>
) => {
  const slaPolicyService = new SLAPolicyService(tenantId, {
    mongoDb: connections.mongoDb,
    dynamoDb: connections.dynamoDb,
  })
  await processCursorInBatch(
    cursor,
    async (entities) => {
      logger.info(`Updating SLA Statuses for ${entities.length} ${type}s`)
      const updates: {
        entityId: string
        slaPolicyDetails: SLAPolicyDetails[]
      }[] = []
      await pMap(
        entities,
        async (entity) => {
          if (!entity.caseId) {
            return
          }
          const slaPolicyDetails = entity.slaPolicyDetails ?? []
          const updatedSlaPolicyDetails = await Promise.all(
            slaPolicyDetails.map(async (slaPolicyDetail) => {
              const slaPolicy = await slaPolicyService.getSLAPolicyById(
                slaPolicyDetail.slaPolicyId
              )
              if (!slaPolicy) {
                return slaPolicyDetail
              }
              const elapsedTime = slaPolicyDetail.elapsedTime
              if (!elapsedTime) {
                return slaPolicyDetail
              }
              const newStatus = getSLAStatusFromElapsedTime(
                elapsedTime,
                slaPolicy.policyConfiguration
              )
              const { timeToWarning, timeToBreach } =
                calculateSLATimeWindowsForPolicy(
                  slaPolicy.policyConfiguration,
                  elapsedTime,
                  getDerivedStatus(
                    type === 'alert'
                      ? (entity as Alert).alertStatus
                      : (entity as Case).caseStatus
                  ),
                  entity.createdTimestamp ?? Date.now()
                )
              return {
                ...slaPolicyDetail,
                policyStatus: newStatus,
                timeToWarning,
                timeToBreach,
              }
            })
          )
          const entityId =
            type === 'alert'
              ? (entity as Alert).alertId
              : (entity as Case).caseId
          if (entityId) {
            updates.push({
              entityId,
              slaPolicyDetails: updatedSlaPolicyDetails,
            })
          }
        },
        {
          concurrency: CONCURRENCY,
        }
      )
      await updateEntity(updates)
    },
    {
      mongoBatchSize: BATCH_SIZE,
      processBatchSize: BATCH_SIZE,
    }
  )
}

async function migrateTenant(tenant: Tenant) {
  const mongoDb = await getMongoDbClient()
  const dynamoDb = getDynamoDbClient()
  const caseCollection = mongoDb
    .db()
    .collection<Case>(CASES_COLLECTION(tenant.id))
  const alertSlaCursor = caseCollection
    .aggregate<Alert>([
      {
        $unwind: {
          path: '$alerts',
        },
      },
      {
        $set: {
          alert: '$alerts',
        },
      },
      {
        $project: {
          alert: 1,
          _id: 0,
        },
      },
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: ['$alert', '$$ROOT'],
          },
        },
      },
      {
        $unset: 'alert',
      },
    ])
    .addCursorFlag('noCursorTimeout', true)
  const caseSlaCursor = caseCollection
    .aggregate<Case>([
      {
        $match: {
          $and: [
            {
              caseType: { $eq: 'MANUAL' },
            },
            { caseStatus: { $exists: true } },
          ],
        },
      },
    ])
    .addCursorFlag('noCursorTimeout', true)
  const alertRepository = new AlertsRepository(tenant.id, {
    mongoDb,
    dynamoDb,
  })
  const caseRepository = new CaseRepository(tenant.id, {
    mongoDb,
    dynamoDb,
  })
  if (hasFeature('ALERT_SLA')) {
    await calculateTimeToWarningAndBreach(
      'alert',
      alertSlaCursor,
      { mongoDb, dynamoDb },
      tenant.id,
      async (updates: SlaUpdates[]) => {
        await alertRepository.updateAlertSlaPolicyDetails(updates)
      }
    )
  }
  if (hasFeature('PNB')) {
    await calculateTimeToWarningAndBreach(
      'case',
      caseSlaCursor,
      { mongoDb, dynamoDb },
      tenant.id,
      async (updates: SlaUpdates[]) => {
        await caseRepository.updateCaseSlaPolicyDetails(updates)
      }
    )
  }
}

export const up = async () => {
  await migrateAllTenants(migrateTenant)
}
export const down = async () => {
  // skip
}
