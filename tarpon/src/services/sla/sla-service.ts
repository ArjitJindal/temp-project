import { AggregationCursor, MongoClient } from 'mongodb'
import pMap from 'p-map'
import { omit } from 'lodash'
import { SLAPolicyService } from '../tenants/sla-policy-service'
import { Account, AccountsService } from '../accounts'
import { getDerivedStatus } from '../cases/utils'
import { AlertsRepository } from '../alerts/repository'
import { CaseRepository } from '../cases/repository'
import {
  getElapsedTime,
  getSLAStatusFromElapsedTime,
  matchPolicyRoleConditions,
  matchPolicyStatusConditions,
} from './sla-utils'
import { traceable } from '@/core/xray'
import { Alert } from '@/@types/openapi-internal/Alert'
import { logger } from '@/core/logger'

import { CaseStatusChange } from '@/@types/openapi-internal/CaseStatusChange'
import { SLAPolicyStatus } from '@/@types/openapi-internal/SLAPolicyStatus'
import { hasFeature } from '@/core/utils/context'
import { processCursorInBatch } from '@/utils/mongodb-utils'
import { Case } from '@/@types/openapi-internal/Case'
import { SLAPolicyDetails } from '@/@types/openapi-internal/SLAPolicyDetails'

const CONCURRENCY = 50
const BATCH_SIZE = 10000

@traceable
export class SLAService {
  private alertsRepository: AlertsRepository
  private slaPolicyService: SLAPolicyService
  private accountsService: AccountsService
  private caseRepository: CaseRepository
  constructor(tenantId: string, mongoDb: MongoClient, auth0Domain: string) {
    this.alertsRepository = new AlertsRepository(tenantId, { mongoDb })
    this.slaPolicyService = new SLAPolicyService(tenantId, mongoDb)
    this.accountsService = new AccountsService({ auth0Domain }, { mongoDb })
    this.caseRepository = new CaseRepository(tenantId, { mongoDb })
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
    { elapsedTime: number; policyStatus: SLAPolicyStatus } | undefined
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
    return elapsedTime > 0
      ? {
          elapsedTime: elapsedTime,
          policyStatus: getSLAStatusFromElapsedTime(
            elapsedTime,
            slaPolicy.policyConfiguration
          ),
        }
      : undefined
  }

  public async calculateAndUpdateSLAStatusesForEntity<T extends Alert | Case>(
    type: 'alert' | 'case',
    cursor: AggregationCursor<T>,
    updateEntity: (
      updatedPolicyDetails: SLAPolicyDetails[],
      entity: T
    ) => Promise<void>
  ) {
    await processCursorInBatch(
      cursor,
      async (entities) => {
        logger.info(`Updating SLA Statuses for ${entities.length} ${type}s`)
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
                }
              })
            )

            await updateEntity(
              updatedSlaPolicyDetails,
              omit(entity, '_id') as T
            )
          },
          {
            concurrency: CONCURRENCY,
          }
        )
        logger.info(`SLA Statuses updated for ${entities.length} ${type}s`)
      },
      { mongoBatchSize: BATCH_SIZE, processBatchSize: BATCH_SIZE }
    )
  }

  public async calculateAndUpdateSLAStatusesForAlerts() {
    if (!hasFeature('ALERT_SLA')) {
      return
    }
    const alertsCursor = this.alertsRepository
      .getNonClosedAlertsCursor()
      .addCursorFlag('noCursorTimeout', true) // As for some tenants the alerts count could be in the millions, we need to make sure the cursor does not timeout
    await this.calculateAndUpdateSLAStatusesForEntity<Alert>(
      'alert',
      alertsCursor,
      async (updatedPolicyDetails, entity) => {
        await this.alertsRepository.saveAlert(entity.caseId ?? '', {
          ...entity,
          slaPolicyDetails: updatedPolicyDetails,
        })
      }
    )
    logger.info('SLA Statuses updated for all alerts')
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
      async (updatedPolicyDetails, entity) => {
        await this.caseRepository.updateCase({
          caseId: entity.caseId,
          slaPolicyDetails: updatedPolicyDetails,
        })
      }
    )
    logger.info('SLA Statuses updated for all manual cases')
  }

  private async getSLAPolicy(slaPolicyId: string) {
    return await this.slaPolicyService.getSLAPolicyById(slaPolicyId)
  }
}
