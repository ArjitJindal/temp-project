import compact from 'lodash/compact'
import memoize from 'lodash/memoize'
import { RandomNumberGenerator } from '../samplers/prng'
import { users } from './users'
import { AUDIT_LOGS_STATUS_CHANGE_SEED, CASES_SEED } from './seeds'
import { getTransactions } from '@/core/seed/data/transactions'
import {
  AuditLogForStatusChangeSampler,
  TransactionUserCasesSampler,
} from '@/core/seed/samplers/cases'
import { Case } from '@/@types/openapi-internal/Case'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { AuditLog } from '@/@types/openapi-internal/AuditLog'

// 1. a user should have atmost 1 case
// 2. alert should have one to one mapping with rule for a user

export const getCases: () => Case[] = memoize(() => {
  const rng = new RandomNumberGenerator(CASES_SEED)
  const childSamplerSeed = rng.randomInt()
  const casesSampler = new TransactionUserCasesSampler(childSamplerSeed)

  const data: Case[] = []

  for (let i = 0; i < users.length; i += 1) {
    const user = users[i]
    const caseTransactions: InternalTransaction[] = getTransactions().filter(
      (t) => {
        return (
          t.originUserId === user.userId || t.destinationUserId === user.userId
        )
      }
    )

    const userCase: Case = casesSampler.getSample(undefined, {
      userId: user.userId,
      user,
      transactions: caseTransactions,
    })
    if (userCase.alerts?.length) {
      data.push(userCase)
    }
  }
  return data
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
