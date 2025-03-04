import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { keyBy, memoize } from 'lodash'
import { MongoClient } from 'mongodb'
import createHttpError from 'http-errors'
import { AccountsService } from '../accounts'
import { FLAGRIGHT_SYSTEM_USER } from '@/utils/user'
import { traceable } from '@/core/xray'
import { CaseStatus } from '@/@types/openapi-internal/CaseStatus'
import {
  isStatusInProgress,
  isStatusInReview,
  isStatusOnHold,
  statusEscalated,
} from '@/utils/helpers'
import { Case as CaseInternal } from '@/@types/openapi-internal/Case'
import { Assignment } from '@/@types/openapi-public-management/Assignment'
import { Status } from '@/@types/openapi-public-management/Status'
import { STATUSS } from '@/@types/openapi-public-management-custom/Status'

@traceable
export class CasesAlertsTransformer {
  public tenantId: string
  public dynamoDb: DynamoDBDocumentClient
  private accountService: AccountsService

  constructor(
    tenantId: string,
    connections: { mongoDb: MongoClient; dynamoDb: DynamoDBDocumentClient }
  ) {
    this.tenantId = tenantId
    this.dynamoDb = connections.dynamoDb
    this.accountService = AccountsService.getInstance(this.dynamoDb)
  }

  public getAllAccounts = memoize(
    async (tenantId: string) => {
      const accounts = await this.accountService.getAllAccountsCache(tenantId)
      return {
        mapByEmail: keyBy(accounts, 'email'),
        list: accounts,
        mapById: keyBy(accounts, 'id'),
      }
    },
    (tenantId) => tenantId
  )

  public async transformAssignmentsToExternalCase(
    status: CaseStatus,
    entity: Pick<CaseInternal, 'assignments' | 'reviewAssignments'>
  ): Promise<Assignment[]> {
    const accounts = await this.getAllAccounts(this.tenantId)

    const accountsMap = accounts.mapById

    const assignments =
      (isStatusInReview(status)
        ? entity.reviewAssignments
        : entity.assignments) || []

    return assignments.map((assignment) => {
      return {
        assigneeEmail:
          accountsMap?.[assignment?.assigneeUserId]?.email ||
          FLAGRIGHT_SYSTEM_USER,
        assignedByEmail: assignment?.assignedByUserId
          ? accountsMap[assignment?.assignedByUserId]?.email ||
            FLAGRIGHT_SYSTEM_USER
          : undefined,
        timestamp: assignment.timestamp,
      }
    })
  }

  public async transformAssignmentsToInternal(
    assignments: Assignment[]
  ): Promise<CaseInternal['assignments']> {
    const accounts = await this.getAllAccounts(this.tenantId)

    const accountsMap = accounts.mapByEmail

    return assignments.map((assignment) => {
      if (!accountsMap[assignment.assigneeEmail]) {
        throw new createHttpError.BadRequest(
          `Assignee email ${assignment.assigneeEmail} not found`
        )
      }

      if (accountsMap[assignment.assigneeEmail].blocked) {
        throw new createHttpError.BadRequest(
          `Seems like assignee email ${assignment.assigneeEmail} is deleted. You can only assign cases to active users. Please invite ${assignment.assigneeEmail} to the platform or assign to another user`
        )
      }

      if (
        assignment.assignedByEmail &&
        !accountsMap[assignment.assignedByEmail]
      ) {
        throw new createHttpError.BadRequest(
          `Assigned by email ${assignment.assignedByEmail} not found`
        )
      }

      if (
        assignment.assignedByEmail &&
        accountsMap[assignment.assignedByEmail].blocked
      ) {
        throw new createHttpError.BadRequest(
          `Seems like assigned by email ${assignment.assignedByEmail} is deleted. You can only assign cases to active users. Please invite ${assignment.assignedByEmail} to the platform or assign to another user`
        )
      }

      return {
        assigneeUserId: accountsMap[assignment.assigneeEmail].id,
        ...(assignment.assignedByEmail && {
          assignedByUserId: accountsMap[assignment.assignedByEmail]?.id,
        }),
        timestamp: assignment.timestamp || Date.now(),
      }
    })
  }

  public getExternalCaseStatus(internalCase: CaseStatus): Status {
    let externalCaseStatus: Status = 'OPEN'

    if (isStatusInReview(internalCase)) {
      externalCaseStatus = 'IN_REVIEW'
    } else if (isStatusInProgress(internalCase)) {
      externalCaseStatus = 'IN_PROGRESS'
    } else if (isStatusOnHold(internalCase)) {
      externalCaseStatus = 'ON_HOLD'
    } else if (statusEscalated(internalCase)) {
      externalCaseStatus = 'ESCALATED'
    } else if (STATUSS.includes(internalCase as Status)) {
      externalCaseStatus = internalCase as Status
    }

    return externalCaseStatus
  }

  public getInternalCaseStatus(externalCaseStatus: Status): CaseStatus {
    let internalCaseStatus: CaseStatus = 'OPEN'

    if (externalCaseStatus === 'IN_REVIEW') {
      internalCaseStatus = 'IN_REVIEW_OPEN'
    } else if (externalCaseStatus === 'IN_PROGRESS') {
      internalCaseStatus = 'OPEN_IN_PROGRESS'
    } else if (externalCaseStatus === 'ON_HOLD') {
      internalCaseStatus = 'OPEN_ON_HOLD'
    } else if (externalCaseStatus === 'ESCALATED') {
      internalCaseStatus = 'ESCALATED'
    } else {
      internalCaseStatus = externalCaseStatus as CaseStatus
    }

    return internalCaseStatus
  }
}
