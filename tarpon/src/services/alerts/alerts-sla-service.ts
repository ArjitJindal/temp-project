import { MongoClient } from 'mongodb'
import pMap from 'p-map'
import { SLAPolicyService } from '../tenants/sla-policy-service'
import { AccountsService } from '../accounts'
import { getDerivedStatus } from '../cases/utils'
import { AlertsRepository } from './repository'
import {
  getElapsedTime,
  getSLAStatusFromElapsedTime,
  matchPolicyRoleConditions,
  matchPolicyStatusConditions,
} from './sla/sla-utils'
import { traceable } from '@/core/xray'
import { Alert } from '@/@types/openapi-internal/Alert'
import { logger } from '@/core/logger'

import { CaseStatusChange } from '@/@types/openapi-internal/CaseStatusChange'
import { SLAPolicyStatus } from '@/@types/openapi-internal/SLAPolicyStatus'
import { hasFeature } from '@/core/utils/context'

const CONCURRENCY = 50

@traceable
export class AlertsSLAService {
  private alertsRepository: AlertsRepository
  private slaPolicyService: SLAPolicyService
  private accountsService: AccountsService
  constructor(tenantId: string, mongoDb: MongoClient, auth0Domain: string) {
    this.alertsRepository = new AlertsRepository(tenantId, { mongoDb })
    this.slaPolicyService = new SLAPolicyService(tenantId, mongoDb)
    this.accountsService = new AccountsService({ auth0Domain }, { mongoDb })
  }

  public async calculateSLAStatusForAlert(
    alert: Alert,
    slaPolicyId: string
  ): Promise<
    { elapsedTime: number; policyStatus: SLAPolicyStatus } | undefined
  > {
    const slaPolicy = await this.getSLAPolicy(slaPolicyId)

    if (!slaPolicy || slaPolicy.isDeleted) {
      logger.warn(`SLA Policy not found for id: ${slaPolicyId}`)
      return
    }

    // As we show these accounts in the UI as assignees but we store them as reviewAssignments
    const accounts = alert.assignments
      ? await Promise.all(
          alert.assignments.map((assignee) => {
            return this.accountsService.getAccount(assignee.assigneeUserId)
          })
        )
      : []
    const reviewAccounts = alert.reviewAssignments
      ? await Promise.all(
          alert.reviewAssignments.map((reviewAssignment) => {
            return this.accountsService.getAccount(
              reviewAssignment.assigneeUserId
            )
          })
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
      timestamp: alert.createdTimestamp,
      caseStatus: 'OPEN',
    }
    const statusChanges = alert.statusChanges
      ? [initialStatusAsChange].concat(alert.statusChanges)
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

  public async calculateAndUpdateSLAStatuses() {
    if (!hasFeature('ALERT_SLA')) {
      return
    }
    const alerts = await this.alertsRepository.getNonClosedAlerts()
    logger.info(`Updating SLA Statuses for ${alerts.length} alerts`)
    await pMap(
      alerts,
      async (alert) => {
        if (!alert.caseId) {
          return
        }
        const slaPolicyDetails = alert.slaPolicyDetails ?? []
        const updatedSlaPolicyDetails = await Promise.all(
          slaPolicyDetails.map(async (slaPolicyDetail) => {
            const statusData = await this.calculateSLAStatusForAlert(
              alert,
              slaPolicyDetail.slaPolicyId
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
        const updatedAlert = {
          ...alert,
          slaPolicyDetails: updatedSlaPolicyDetails,
        }
        await this.alertsRepository.saveAlert(alert.caseId, updatedAlert)
      },
      {
        concurrency: CONCURRENCY,
      }
    )
    logger.info('SLA Statuses updated')
  }

  private async getSLAPolicy(slaPolicyId: string) {
    return await this.slaPolicyService.getSLAPolicyById(slaPolicyId)
  }
}
