import { compact, memoize, uniqBy } from 'lodash'
import { RandomNumberGenerator } from '../samplers/prng'
import { getUsers } from './users'
import { AUDIT_LOGS_STATUS_CHANGE_SEED, CASES_SEED } from './seeds'
import { getTransactions } from '@/core/seed/data/transactions'
import {
  AuditLogForStatusChangeSampler,
  TransactionUserCasesSampler,
} from '@/core/seed/samplers/cases'
import { Case } from '@/@types/openapi-internal/Case'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { AuditLog } from '@/@types/openapi-internal/AuditLog'

export const getCases: () => Case[] = memoize(() => {
  const rng = new RandomNumberGenerator(CASES_SEED)
  const childSamplerSeed = rng.randomInt()
  const originalCasesSampler = new TransactionUserCasesSampler(childSamplerSeed)
  const destinationCasesSampler = new TransactionUserCasesSampler(
    childSamplerSeed
  )

  const data: Case[] = []
  const processedUsers = new Set()

  for (let i = 0; i < getUsers().length; i += 1) {
    const user = getUsers()[i]
    if (processedUsers.has(user.userId)) {
      continue
    }
    processedUsers.add(user.userId)
    const transactionsForUserAsOrigin: InternalTransaction[] =
      getTransactions().filter((t) => {
        return t.originUserId === user.userId
      })
    const transactionsForUserADestination: InternalTransaction[] =
      getTransactions().filter((t) => {
        return t.destinationUserId === user.userId
      })
    const destinationCases: Case[] = destinationCasesSampler
      .getSample(undefined, {
        transactions: transactionsForUserADestination,
        userId: user.userId,
        destination: user,
      })
      .map((c) => ({
        ...c,
        createdTimestamp: rng.randomTimestamp(3600 * 1000 * i),
      }))
    const originCases: Case[] = originalCasesSampler
      .getSample(undefined, {
        transactions: transactionsForUserAsOrigin,
        userId: user.userId,
        origin: user,
      })
      .map((c) => ({
        ...c,
        createdTimestamp: rng.r(1).randomTimestamp(3600 * 1000 * i),
      }))

    data.push(...destinationCases)
    data.push(...originCases)
  }

  const uniqueCases = uniqBy(data, 'caseId')
  return uniqueCases
})

export const auditLogForCaseStatusChange: () => AuditLog[] = memoize(() => {
  const sampler = new AuditLogForStatusChangeSampler(
    AUDIT_LOGS_STATUS_CHANGE_SEED
  )

  return compact<AuditLog>(
    getCases().map((caseItem) => {
      return caseItem?.caseStatus !== 'OPEN'
        ? sampler.getSample(undefined, caseItem)
        : null
    })
  )
})
