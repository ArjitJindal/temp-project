import { v4 as uuid4 } from 'uuid'
import memoize from 'lodash/memoize'
import { generateNarrative } from '../samplers/cases'
import { users } from './users'
import { transactionRules as rules, ruleInstances } from './rules'
import { auditLogForCaseStatusChange } from './cases'
import { AUDIT_LOG_SEED } from './seeds'
import { AuditLog } from '@/@types/openapi-internal/AuditLog'
import { getAccounts } from '@/core/seed/samplers/accounts'
import { RandomNumberGenerator } from '@/core/seed/samplers/prng'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { RuleAction } from '@/@types/openapi-internal/RuleAction'
import { RuleMode } from '@/@types/openapi-internal/RuleMode'

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
    if (i % 4 === 0) {
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
    else if (i % 4 === 1) {
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
    else if (i % 4 === 2) {
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

    // Rule Update
    else if (i % 4 === 3) {
      const oldRuleData =
        ruleInstances()[rng.r(1).randomInt(ruleInstances().length)]
      const riskLevelActions = ['FLAG', 'SUSPEND', 'BLOCK', 'REVIEW']
      const newRuleData: RuleInstance = {
        ...oldRuleData,
        ruleNameAlias: `${oldRuleData.ruleNameAlias} (Updated)`,
        ruleDescriptionAlias: `${oldRuleData.ruleDescriptionAlias} - Modified for compliance`,
        status: oldRuleData.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE', // Toggle status
        updatedAt: rng.randomTimestamp(THIRTY_DAYS),
        riskLevelActions: {
          VERY_HIGH: riskLevelActions[
            rng.r(1).randomInt(riskLevelActions.length)
          ] as RuleAction,
          HIGH: riskLevelActions[
            rng.r(1).randomInt(riskLevelActions.length)
          ] as RuleAction,
          MEDIUM: riskLevelActions[
            rng.r(1).randomInt(riskLevelActions.length)
          ] as RuleAction,
          LOW: riskLevelActions[
            rng.r(1).randomInt(riskLevelActions.length)
          ] as RuleAction,
          VERY_LOW: riskLevelActions[
            rng.r(1).randomInt(riskLevelActions.length)
          ] as RuleAction,
        },
        mode: rng
          .r(1)
          .pickRandom([
            'LIVE_SYNC',
            'SHADOW_SYNC',
            'LIVE_ASYNC',
            'SHADOW_ASYNC',
          ]) as RuleMode,
      }

      fullAuditLog = {
        auditlogId: uuid4(),
        type: 'RULE',
        action: 'UPDATE',
        timestamp: rng.randomTimestamp(THIRTY_DAYS),
        entityId: oldRuleData.ruleId,
        oldImage: oldRuleData,
        newImage: newRuleData,
        user: rng.r(4).pickRandom(getAccounts()),
        logMetadata: {
          ruleId: oldRuleData.ruleId,
          id: oldRuleData.id,
        },
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
