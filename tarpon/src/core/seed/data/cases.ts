import { compact, memoize, uniqBy } from 'lodash'
import { getUsers } from './users'
import { getTransactions } from '@/core/seed/data/transactions'
import {
  sampleAuditLogForStatusChange,
  sampleTransactionUserCases,
} from '@/core/seed/samplers/cases'
import { sampleTimestamp } from '@/core/seed/samplers/timestamp'
import { Case } from '@/@types/openapi-internal/Case'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { AuditLog } from '@/@types/openapi-internal/AuditLog'

export const getCases: () => Case[] = memoize(() => {
  const data: Case[] = []
  for (let i = 0; i < getUsers().length; i += 1) {
    const user = getUsers()[i]
    const transactionsForUserAsOrigin: InternalTransaction[] =
      getTransactions().filter((t) => {
        return t.originUserId === user.userId
      })
    const transactionsForUserADestination: InternalTransaction[] =
      getTransactions().filter((t) => {
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

  const uniqueCases = uniqBy(data, 'caseId')

  return uniqueCases
})

export const auditLogForCaseStatusChange: () => AuditLog[] = memoize(() => {
  return compact<AuditLog>(
    getCases().map((caseItem) => {
      return caseItem?.caseStatus !== 'OPEN'
        ? (sampleAuditLogForStatusChange(caseItem) as AuditLog)
        : null
    })
  )
})
