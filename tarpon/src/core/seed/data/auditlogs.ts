import { v4 as uuid4 } from 'uuid'
import { generateNarrative } from '../samplers/cases'
import { data as users } from './users'
import { transactionRules as rules } from './rules'
import { randomInt } from '@/core/seed/samplers/prng'
import { AuditLog } from '@/@types/openapi-internal/AuditLog'

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
    if (i % 3 === 0) {
      const userId = users[randomInt(users.length)].userId

      fullAuditLog = {
        type: 'USER',
        auditlogId: uuid4(),
        action: 'VIEW',
        timestamp: Date.now(),
        entityId: userId,
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
            [rules[randomInt(rules.length)].ruleDescription],
            ['Anti-money laundering'],
            users[randomInt(users.length)]
          ),
        },
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
              [rules[randomInt(rules.length)].ruleDescription],
              ['Anti-money laundering'],
              users[randomInt(users.length)]
            ),
          },
        }
      }
    }

    yield fullAuditLog
  }
}

const generate: () => Iterable<AuditLog> = () => generator()

const auditlogs: AuditLog[] = []

const init = () => {
  if (auditlogs.length > 0) {
    return
  }
  const data = generate()
  for (const auditLog of data) {
    auditlogs.push(auditLog)
  }
}

export { init, generate, auditlogs }
