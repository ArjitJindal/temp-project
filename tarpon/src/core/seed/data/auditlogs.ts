import { v4 as uuid4 } from 'uuid'
import memoize from 'lodash/memoize'
import { generateNarrative } from '../samplers/cases'
import { users } from './users'
import { transactionRules as rules } from './rules'
import { auditLogForCaseStatusChange } from './cases'
import { AUDIT_LOG_SEED } from './seeds'
import { AuditLog } from '@/@types/openapi-internal/AuditLog'
import { getAccounts } from '@/core/seed/samplers/accounts'
import { RandomNumberGenerator } from '@/core/seed/samplers/prng'

const AUDIT_LOG_COUNT = 100
// 30 days in milliseconds
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000

const generator = function* (): Generator<AuditLog> {
  const rng = new RandomNumberGenerator(AUDIT_LOG_SEED)

  for (let i = 0; i < AUDIT_LOG_COUNT; i += 1) {
    let fullAuditLog: AuditLog = {
      auditlogId: uuid4(),
      type: 'USER',
      action: 'VIEW',
      timestamp: rng.randomTimestamp(THIRTY_DAYS),
      entityId: uuid4(),
      user: rng.pickRandom(getAccounts()),
    }
    const allUsers = users

    // User Viewed
    if (i % 3 === 0) {
      const userId = allUsers[rng.r(1).randomInt(allUsers.length)].userId

      fullAuditLog = {
        type: 'USER',
        auditlogId: uuid4(),
        action: 'VIEW',
        timestamp: rng.randomTimestamp(THIRTY_DAYS),
        entityId: userId,
        user: rng.r(2).pickRandom(getAccounts()),
      }
    }

    // Case Comment created
    else if (i % 3 === 1) {
      fullAuditLog = {
        auditlogId: uuid4(),
        type: 'CASE',
        action: 'CREATE',
        subtype: 'COMMENT',
        timestamp: rng.randomTimestamp(THIRTY_DAYS),
        entityId: `C-${rng.r(1).randomInt(25)}`,
        oldImage: undefined,
        newImage: {
          id: uuid4(),
          body: generateNarrative(
            [rules()[rng.r(2).randomInt(rules().length)].ruleDescription],
            ['Anti-money laundering'],
            allUsers[rng.r(3).randomInt(allUsers.length)]
          ),
        },
        user: rng.r(4).pickRandom(getAccounts()),
      }
    }

    // Alert Comment created
    else if (i % 3 === 2) {
      fullAuditLog = {
        auditlogId: uuid4(),
        type: 'ALERT',
        action: 'UPDATE',
        timestamp: rng.randomTimestamp(THIRTY_DAYS),
        entityId: `A-${rng.r(1).randomInt(25)}`,
        oldImage: {},
        newImage: {
          reason: ['Anti-money laundering'],
          body: generateNarrative(
            [rules()[rng.r(2).randomInt(rules().length)].ruleDescription],
            ['Anti-money laundering'],
            allUsers[rng.r(3).randomInt(allUsers.length)]
          ),
        },
        user: rng.r(4).pickRandom(getAccounts()),
      }
    }

    rng.setSeed(rng.getSeed() + 1)
    yield fullAuditLog
  }
}

const generate: () => Iterable<AuditLog> = () => generator()

export const auditlogs: () => AuditLog[] = memoize(() => {
  return [...auditLogForCaseStatusChange(), ...generate()]
})
