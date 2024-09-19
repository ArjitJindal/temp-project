import { v4 as uuid4 } from 'uuid'
import { memoize } from 'lodash'
import { generateNarrative } from '../samplers/cases'
import { getUsers } from './users'
import { transactionRules as rules } from './rules'
import { auditLogForCaseStatusChange } from './cases'
import { randomInt } from '@/core/seed/samplers/prng'
import { AuditLog } from '@/@types/openapi-internal/AuditLog'
import { getRandomAccount } from '@/core/seed/samplers/accounts'

const AUDIT_LOG_COUNT = 100
const generator = function* (): Generator<AuditLog> {
  for (let i = 0; i < AUDIT_LOG_COUNT; i += 1) {
    let fullAuditLog: AuditLog = {
      auditlogId: uuid4(),

      type: 'USER',
      action: 'VIEW',
      timestamp: Date.now(),
      entityId: uuid4(),
    }
    // User Viewed
    const allUsers = getUsers()

    if (i % 3 === 0) {
      const userId = allUsers[randomInt(allUsers.length)].userId

      fullAuditLog = {
        type: 'USER',
        auditlogId: uuid4(),
        action: 'VIEW',
        timestamp: Date.now(),
        entityId: userId,
        user: getRandomAccount(),
      }
    }
    // Case Comment created
    if (i % 3 === 1) {
      fullAuditLog = {
        auditlogId: uuid4(),
        type: 'CASE',
        action: 'CREATE',
        subtype: 'COMMENT',
        timestamp: Date.now(),
        entityId: `C-${randomInt(25)}`,
        oldImage: undefined,
        newImage: {
          id: uuid4(),
          body: generateNarrative(
            [rules()[randomInt(rules().length)].ruleDescription],
            ['Anti-money laundering'],
            allUsers[randomInt(allUsers.length)]
          ),
        },
        user: getRandomAccount(),
      }
      // Alert Comment created
      if (i % 3 === 2) {
        fullAuditLog = {
          auditlogId: uuid4(),
          type: 'ALERT',
          action: 'UPDATE',
          timestamp: Date.now(),
          entityId: `A-${randomInt(25)}`,
          oldImage: {},
          newImage: {
            reason: ['Anti-money laundering'],
            body: generateNarrative(
              [rules()[randomInt(rules().length)].ruleDescription],
              ['Anti-money laundering'],
              allUsers[randomInt(allUsers.length)]
            ),
          },
          user: getRandomAccount(),
        }
      }
    }

    yield fullAuditLog
  }
}

const generate: () => Iterable<AuditLog> = () => generator()

const auditlogs: () => AuditLog[] = memoize(() => {
  return [...auditLogForCaseStatusChange(), ...generate()]
})

export { generate, auditlogs }
