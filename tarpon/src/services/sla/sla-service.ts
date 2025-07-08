import { AggregationCursor, MongoClient } from 'mongodb'
import pMap from 'p-map'
import { compact, omit, range } from 'lodash'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { SLAPolicyService } from '../tenants/sla-policy-service'
import { AccountsService } from '../accounts'
import { getDerivedStatus } from '../cases/utils'
import { AlertsRepository } from '../alerts/repository'
import { CaseRepository } from '../cases/repository'
import { sendBatchJobCommand } from '../batch-jobs/batch-job'
import {
  getElapsedTime,
  getSLAStatusFromElapsedTime,
  matchPolicyRoleConditions,
  matchPolicyStatusConditions,
} from './sla-utils'
import { SLAAuditLogService } from './sla-audit-log-service'
import { traceable } from '@/core/xray'
import { Alert } from '@/@types/openapi-internal/Alert'
import { logger } from '@/core/logger'

import { CaseStatusChange } from '@/@types/openapi-internal/CaseStatusChange'
import { SLAPolicyStatus } from '@/@types/openapi-internal/SLAPolicyStatus'
import { hasFeature } from '@/core/utils/context'
import { processCursorInBatch } from '@/utils/mongodb-utils'
import { Case } from '@/@types/openapi-internal/Case'
import { SLAPolicyDetails } from '@/@types/openapi-internal/SLAPolicyDetails'
import { CASES_COLLECTION } from '@/utils/mongodb-definitions'
import { Account } from '@/@types/openapi-internal/Account'

const CONCURRENCY = 50
const BATCH_SIZE = 10000

export type SlaUpdates = {
  entityId: string
  slaPolicyDetails: SLAPolicyDetails[]
}

@traceable
export class SLAService {
  private alertsRepository: AlertsRepository
  private slaPolicyService: SLAPolicyService
  private accountsService: AccountsService
  private caseRepository: CaseRepository
  private mongoDb: MongoClient
  private tenantId: string
  private slaAuditLogService: SLAAuditLogService

  constructor(
    tenantId: string,
    auth0Domain: string,
    connections: { mongoDb: MongoClient; dynamoDb: DynamoDBClient }
  ) {
    this.mongoDb = connections.mongoDb
    this.tenantId = tenantId
    this.alertsRepository = new AlertsRepository(tenantId, connections)
    this.slaPolicyService = new SLAPolicyService(tenantId, {
      mongoDb: connections.mongoDb,
      dynamoDb: connections.dynamoDb,
    })
    this.accountsService = new AccountsService({ auth0Domain }, connections)
    this.caseRepository = new CaseRepository(tenantId, connections)
    this.slaAuditLogService = new SLAAuditLogService(tenantId)
  }

  private async getAccounts(userIds: string[]): Promise<Account[]> {
    const accounts = await Promise.all(
      userIds.map((userId) => this.accountsService.getAccount(userId))
    )
    return accounts.filter((account) => account !== null) as Account[]
  }

  public async calculateSLAStatusForEntity<T extends Alert | Case>(
    entity: T,
    slaPolicyId: string,
    type: 'alert' | 'case' = 'alert'
  ): Promise<
    | { elapsedTime: number; policyStatus: SLAPolicyStatus; startedAt: number }
    | undefined
  > {
    const slaPolicy = await this.getSLAPolicy(slaPolicyId)
    if (
      (slaPolicy?.type === 'ALERT' && type === 'case') ||
      (slaPolicy?.type === 'MANUAL_CASE' && type === 'alert')
    ) {
      logger.warn(
        `SLA Policy type mismatch: ${slaPolicy?.type} for ${type} with id: ${slaPolicyId}`
      )
      return
    }
    if (!slaPolicy || slaPolicy.isDeleted) {
      logger.warn(`SLA Policy not found for id: ${slaPolicyId}`)
      return
    }

    const accounts = entity.assignments
      ? await this.getAccounts(
          entity.assignments.map((assignee) => assignee.assigneeUserId)
        )
      : []
    const reviewAccounts = entity.reviewAssignments
      ? await this.getAccounts(
          entity.reviewAssignments.map(
            (reviewAssignment) => reviewAssignment.assigneeUserId
          )
        )
      : []
    const isRoleMatched = matchPolicyRoleConditions(
      slaPolicy.policyConfiguration,
      accounts.concat(reviewAccounts)
    )
    if (!isRoleMatched) {
      return undefined
    }
    const initialStatusAsChange: CaseStatusChange = {
      userId: 'system',
      timestamp: entity.createdTimestamp ?? Date.now(),
      caseStatus: 'OPEN',
    }
    const statusChanges = entity.statusChanges
      ? [initialStatusAsChange].concat(entity.statusChanges)
      : [initialStatusAsChange]
    const countMap = new Map<string, number>()
    let elapsedTime = 0

    statusChanges.forEach((statusChange, index) => {
      const status = getDerivedStatus(statusChange.caseStatus)
      countMap.set(status, (countMap.get(status) ?? 0) + 1)
      if (
        statusChange.caseStatus &&
        matchPolicyStatusConditions(
          statusChange.caseStatus,
          countMap.get(status) ?? 0,
          slaPolicy.policyConfiguration,
          {
            makerAccounts: accounts,
            reviewerAccounts: reviewAccounts,
          }
        )
      ) {
        elapsedTime += getElapsedTime(
          statusChange.timestamp,
          statusChanges[index + 1]?.timestamp ?? Date.now(),
          slaPolicy.policyConfiguration.workingDays
        )
      }
    })
    if (elapsedTime <= 0) {
      return undefined
    }

    const newStatus = getSLAStatusFromElapsedTime(
      elapsedTime,
      slaPolicy.policyConfiguration
    )

    const existingStatus = entity.slaPolicyDetails?.find(
      (detail) => detail.slaPolicyId === slaPolicyId
    )?.policyStatus

    let entityId: string | undefined
    if (type === 'alert') {
      entityId = (entity as Alert).alertId
    } else {
      entityId = (entity as Case).caseId
    }
    if (!entityId) {
      return undefined
    }

    if (existingStatus !== newStatus) {
      await this.slaAuditLogService.handleAuditLogForSLAStatusChange(
        entityId,
        existingStatus,
        newStatus,
        slaPolicyId,
        elapsedTime
      )
    }

    return {
      elapsedTime: elapsedTime,
      policyStatus: newStatus,
      startedAt: entity.createdTimestamp ?? Date.now(),
    }
  }

  public async calculateAndUpdateSLAStatusesForEntity<T extends Alert | Case>(
    type: 'alert' | 'case',
    cursor: AggregationCursor<T>,
    updateEntity: (updates: SlaUpdates[]) => Promise<void>
  ) {
    await processCursorInBatch(
      cursor,
      async (entities) => {
        logger.debug(`Updating SLA Statuses for ${entities.length} ${type}s`)
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
                const statusData = await this.calculateSLAStatusForEntity<T>(
                  omit(entity, '_id') as T,
                  slaPolicyDetail.slaPolicyId,
                  type
                )
                if (!statusData) {
                  return slaPolicyDetail
                }
                return {
                  ...slaPolicyDetail,
                  elapsedTime: statusData.elapsedTime,
                  policyStatus: statusData.policyStatus,
                  updatedAt: Date.now(),
                  startedAt: statusData.startedAt,
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
        logger.debug(`SLA Statuses updated for ${entities.length} ${type}s`)
      },
      { mongoBatchSize: BATCH_SIZE, processBatchSize: BATCH_SIZE }
    )
  }

  public async calculateAndUpdateSLAStatusesForAlerts(
    from?: string,
    to?: string
  ) {
    if (!hasFeature('ALERT_SLA')) {
      return
    }
    const alertsCursor = this.alertsRepository
      .getNonClosedAlertsCursor(from, to)
      .addCursorFlag('noCursorTimeout', true) // As for some tenants the alerts count could be in the millions, we need to make sure the cursor does not timeout
    await this.calculateAndUpdateSLAStatusesForEntity<Alert>(
      'alert',
      alertsCursor,
      async (updates: SlaUpdates[]) => {
        if (updates.length === 0) {
          return
        }

        await this.alertsRepository.updateAlertSlaPolicyDetails(updates)
      }
    )
    logger.debug('SLA Statuses updated for all alerts')
  }

  public async calculateAndUpdateSLAStatusesForCases() {
    if (!hasFeature('PNB')) {
      return
    }
    const casesCursor = this.caseRepository
      .getNonClosedManualCasesCursor()
      .addCursorFlag('noCursorTimeout', true)
    await this.calculateAndUpdateSLAStatusesForEntity<Case>(
      'case',
      casesCursor,
      async (updates: SlaUpdates[]) => {
        if (updates.length === 0) {
          return
        }

        await this.caseRepository.updateCaseSlaPolicyDetails(updates)
      }
    )
    logger.debug('SLA Statuses updated for all manual cases')
  }

  private async getSLAPolicy(slaPolicyId: string) {
    return await this.slaPolicyService.getSLAPolicyById(slaPolicyId)
  }

  public async handleSendingSlaRefreshJobs() {
    const casesCollection = this.mongoDb
      .db()
      .collection(CASES_COLLECTION(this.tenantId))
    const matchFilter = {
      $match: {
        'alerts.alertStatus': {
          $ne: 'CLOSED',
        },
      },
    }
    const targetAlertsCount = await casesCollection
      .aggregate([
        matchFilter,
        {
          $unwind: '$alerts',
        },
        matchFilter,
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
          },
        },
      ])
      .toArray()
    const numberOfJobs = Math.ceil((targetAlertsCount[0]?.count ?? 0) / 50_000)
    const froms = compact(
      await Promise.all(
        range(numberOfJobs).map(async (i): Promise<string | null> => {
          const entity = (
            await casesCollection
              .aggregate([
                matchFilter,
                {
                  $unwind: '$alerts',
                },
                matchFilter,
                {
                  $sort: {
                    'alerts.alertId': 1,
                  },
                },
                {
                  $skip: i * 50_000,
                },
                {
                  $limit: 1,
                },
              ])
              .toArray()
          )[0]

          if (entity) {
            return entity.alerts.alertId
          }
          return null
        })
      )
    )
    for (let i = 0; i < froms.length; i++) {
      const from = froms[i]
      const to = froms[i + 1] || undefined // Use `null` as `to` for the last batch

      logger.info(`Sending batch job #${i}`)
      await sendBatchJobCommand({
        type: 'ALERT_SLA_STATUS_REFRESH',
        tenantId: this.tenantId,
        from,
        to,
      })
    }
  }
}
