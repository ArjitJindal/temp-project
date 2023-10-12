import { data as users } from './users'
import { transactions } from '@/core/seed/data/transactions'
import {
  sampleAuditLogForStatusChange,
  sampleTransactionUserCases,
} from '@/core/seed/samplers/cases'
import { sampleTimestamp } from '@/core/seed/samplers/timestamp'
import { Case } from '@/@types/openapi-internal/Case'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { AuditLog } from '@/@types/openapi-internal/AuditLog'

const data: Case[] = []

const auditLogForCaseStatusChange: AuditLog[] = []

const init = () => {
  if (data.length > 0) {
    return
  }
  for (let i = 0; i < users.length; i += 1) {
    const user = users[i]
    const transactionsForUserAsOrigin: InternalTransaction[] =
      transactions.filter((t) => {
        return t.originUserId === user.userId
      })
    const transactionsForUserADestination: InternalTransaction[] =
      transactions.filter((t) => {
        return t.destinationUserId === user.userId
      })
    const destinationCases: Case[] = sampleTransactionUserCases({
      transactions: transactionsForUserADestination,
      userId: user.userId,
      destination: user,
    }).map((c) => ({
      ...c,
      createdTimestamp: sampleTimestamp() - 3600 * 1000 * i,
    }))
    const originCases: Case[] = sampleTransactionUserCases({
      transactions: transactionsForUserAsOrigin,
      userId: user.userId,
      origin: user,
    }).map((c) => ({
      ...c,
      createdTimestamp: sampleTimestamp() - 3600 * 1000 * i,
    }))

    data.push(...destinationCases)
    data.push(...originCases)
  }
  data.map((caseItem) => {
    if (caseItem.caseStatus !== 'OPEN') {
      const auditLog = sampleAuditLogForStatusChange(caseItem)
      auditLogForCaseStatusChange.push(auditLog as AuditLog)
    }
  })
}

export { init, data, auditLogForCaseStatusChange }
