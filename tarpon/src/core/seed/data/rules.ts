import { random, cloneDeep } from 'lodash'
import { ExecutedRulesResult } from '@/@types/openapi-public/ExecutedRulesResult'
import { pickRandom, randomSubset } from '@/core/seed/samplers/prng'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { RuleAction } from '@/@types/openapi-internal/RuleAction'
import { SanctionsBusinessUserRuleParameters } from '@/services/rules-engine/user-rules/sanctions-business-user'
import { SanctionsBankUserRuleParameters } from '@/services/rules-engine/user-rules/sanctions-bank-name'
import { SanctionsConsumerUserRuleParameters } from '@/services/rules-engine/user-rules/sanctions-consumer-user'
import { checklistTemplates } from '@/core/seed/data/checklists'

export const getRuleInstance = (ruleInstanceId: string): RuleInstance => {
  return ruleInstances.find((ri) => (ri.id = ruleInstanceId)) as RuleInstance
}

export const initRules = () => {
  if (ruleInstances.length > 0) {
    return
  }
  ruleInstances.push(
    {
      id: 'e8c3b853',
      checklistTemplateId: pickRandom(checklistTemplates).id,
      ruleId: 'R-1',
      casePriority: 'P1',
      parameters: {},
      action: 'FLAG',
      type: 'TRANSACTION',
      ruleNameAlias: 'First payment of a Customers',
      ruleDescriptionAlias: 'First transaction of a user',
      filters: {},
      riskLevelParameters: {
        VERY_HIGH: {},
        HIGH: {},
        MEDIUM: {},
        LOW: {},
        VERY_LOW: {},
      },
      riskLevelActions: {
        VERY_HIGH: 'FLAG',
        HIGH: 'FLAG',
        MEDIUM: 'FLAG',
        LOW: 'FLAG',
        VERY_LOW: 'FLAG',
      },
      nature: 'AML',
      labels: [],
      status: 'ACTIVE',
      createdAt: 1685604237253,
      updatedAt: 1688115753059,
      runCount: 1848,
      hitCount: 8,
    },
    {
      id: 'a25685ad',
      checklistTemplateId: pickRandom(checklistTemplates).id,
      ruleId: 'R-2',
      casePriority: 'P2',
      parameters: {
        transactionAmountThreshold: {
          USD: 10000,
        },
      },
      action: 'SUSPEND',
      type: 'TRANSACTION',
      ruleNameAlias: 'Transaction amount too high',
      ruleDescriptionAlias: 'Transaction amount is >= x in USD or equivalent',
      filters: {},
      riskLevelParameters: {
        VERY_HIGH: {
          transactionAmountThreshold: {
            USD: 10000,
          },
        },
        HIGH: {
          transactionAmountThreshold: {
            USD: 10000,
          },
        },
        MEDIUM: {
          transactionAmountThreshold: {
            USD: 10000,
          },
        },
        LOW: {
          transactionAmountThreshold: {
            USD: 10000,
          },
        },
        VERY_LOW: {
          transactionAmountThreshold: {
            USD: 10000,
            ADA: 1000,
          },
        },
      },
      riskLevelActions: {
        VERY_HIGH: 'SUSPEND',
        HIGH: 'SUSPEND',
        MEDIUM: 'SUSPEND',
        LOW: 'SUSPEND',
        VERY_LOW: 'SUSPEND',
      },
      nature: 'AML',
      labels: [],
      status: 'ACTIVE',
      createdAt: 1685604282954,
      updatedAt: 1688114634781,
      runCount: 1848,
      hitCount: 1434,
    },
    {
      id: 'a45615ad',
      checklistTemplateId: pickRandom(checklistTemplates).id,
      ruleId: 'R-30',
      casePriority: 'P1',
      parameters: {
        timeWindow: {
          unit: 1,
          granularity: 'day',
        },
        uniqueUsersCountThreshold: 10,
      },
      action: 'FLAG',
      type: 'TRANSACTION',
      ruleNameAlias: 'High velocity user',
      ruleDescriptionAlias: 'High velocity user',
      filters: {},
      riskLevelParameters: {
        VERY_HIGH: {
          timeWindow: {
            unit: 1,
            granularity: 'day',
          },
          uniqueUsersCountThreshold: 10,
        },
        HIGH: {
          timeWindow: {
            unit: 1,
            granularity: 'day',
          },
          uniqueUsersCountThreshold: 10,
        },
        MEDIUM: {
          timeWindow: {
            unit: 1,
            granularity: 'day',
          },
          uniqueUsersCountThreshold: 10,
        },
        LOW: {
          timeWindow: {
            unit: 1,
            granularity: 'day',
          },
          uniqueUsersCountThreshold: 10,
        },
        VERY_LOW: {
          timeWindow: {
            unit: 1,
            granularity: 'day',
          },
          uniqueUsersCountThreshold: 10,
        },
      },
      riskLevelActions: {
        VERY_HIGH: 'FLAG',
        HIGH: 'FLAG',
        MEDIUM: 'FLAG',
        LOW: 'FLAG',
        VERY_LOW: 'FLAG',
      },
      nature: 'AML',
      labels: [],
      status: 'ACTIVE',
      createdAt: 1685604282954,
      updatedAt: 1688114634781,
      runCount: 1848,
      hitCount: 1434,
    },
    {
      id: '2i3nflkd',
      checklistTemplateId: pickRandom(checklistTemplates).id,
      ruleId: 'R-16',
      casePriority: 'P1',
      parameters: {},
      action: 'BLOCK',
      type: 'USER',
      ruleNameAlias: 'Screening on Consumer users',
      ruleDescriptionAlias:
        'Sanctions/PEP/Adverse media screening on Consumer users.',
      filters: {},
      riskLevelParameters: {
        VERY_HIGH: {
          transactionAmountThreshold: {
            USD: 10000,
          },
          fuzziness: 20,
          ongoingScreening: false,
          screeningTypes: ['PEP'],
        } as SanctionsConsumerUserRuleParameters,
        HIGH: {
          transactionAmountThreshold: {
            USD: 10000,
          },
          fuzziness: 20,
          ongoingScreening: false,
          screeningTypes: ['PEP'],
        },
        MEDIUM: {
          transactionAmountThreshold: {
            USD: 10000,
          },
          fuzziness: 20,
          ongoingScreening: false,
          screeningTypes: ['PEP'],
        },
        LOW: {
          transactionAmountThreshold: {
            USD: 10000,
          },
          fuzziness: 20,
          ongoingScreening: false,
          screeningTypes: ['PEP'],
        },
        VERY_LOW: {
          transactionAmountThreshold: {
            USD: 10000,
            ADA: 1000,
          },
          fuzziness: 20,
          ongoingScreening: false,
          screeningTypes: ['PEP'],
        },
      },
      riskLevelActions: {
        VERY_HIGH: 'BLOCK',
        HIGH: 'BLOCK',
        MEDIUM: 'BLOCK',
        LOW: 'BLOCK',
        VERY_LOW: 'BLOCK',
      },
      nature: 'SCREENING',
      labels: [],
      status: 'ACTIVE',
      createdAt: 1685604282954,
      updatedAt: 1688114634781,
      runCount: 295,
      hitCount: 102,
    } as RuleInstance,
    {
      id: 'skn2ls',
      checklistTemplateId: pickRandom(checklistTemplates).id,
      ruleId: 'R-32',
      casePriority: 'P1',
      parameters: {},
      action: 'SUSPEND',
      type: 'USER',
      ruleNameAlias: 'Screening on Bank name',
      ruleDescriptionAlias:
        'Sanctions/PEP/Adverse media screening on Bank names. IBAN number resolution option available in rule configuration.',
      filters: {},
      riskLevelParameters: {
        VERY_HIGH: {
          transactionAmountThreshold: {
            USD: 10000,
          },
          fuzziness: 20,
          ongoingScreening: false,
          screeningTypes: ['PEP'],
          resolveIban: false,
        } as SanctionsBankUserRuleParameters,
        HIGH: {
          transactionAmountThreshold: {
            USD: 10000,
          },
          fuzziness: 20,
          ongoingScreening: false,
          screeningTypes: ['PEP'],
          resolveIban: false,
        },
        MEDIUM: {
          transactionAmountThreshold: {
            USD: 10000,
          },
          fuzziness: 20,
          ongoingScreening: false,
          screeningTypes: ['PEP'],
          resolveIban: false,
        },
        LOW: {
          transactionAmountThreshold: {
            USD: 10000,
          },
          fuzziness: 20,
          ongoingScreening: false,
          screeningTypes: ['PEP'],
          resolveIban: false,
        },
        VERY_LOW: {
          transactionAmountThreshold: {
            USD: 10000,
            ADA: 1000,
          },
          fuzziness: 20,
          ongoingScreening: false,
          screeningTypes: ['PEP'],
          resolveIban: false,
        },
      },
      riskLevelActions: {
        VERY_HIGH: 'SUSPEND',
        HIGH: 'SUSPEND',
        MEDIUM: 'SUSPEND',
        LOW: 'SUSPEND',
        VERY_LOW: 'SUSPEND',
      },
      nature: 'SCREENING',
      labels: [],
      status: 'ACTIVE',
      createdAt: 1685604282954,
      updatedAt: 1688114634781,
      runCount: 603,
      hitCount: 340,
    },
    {
      id: '3oi3nlk',
      checklistTemplateId: pickRandom(checklistTemplates).id,
      ruleId: 'R-128',
      casePriority: 'P1',
      parameters: {},
      action: 'SUSPEND',
      type: 'USER',
      ruleNameAlias:
        'Screening on Business legal entity & shareholders & directors',
      ruleDescriptionAlias:
        'Sanctions/PEP/Adverse media screening on Business legal entity & shareholders & directors',
      filters: {},
      riskLevelParameters: {
        VERY_HIGH: {
          transactionAmountThreshold: {
            USD: 10000,
          },
          fuzziness: 20,
          ongoingScreening: false,
          screeningTypes: ['PEP', 'SANCTION', 'ADVERSE_MEDIA'],
        } as SanctionsBusinessUserRuleParameters,
        HIGH: {
          transactionAmountThreshold: {
            USD: 10000,
          },
          fuzziness: 20,
          ongoingScreening: false,
          screeningTypes: ['PEP', 'SANCTION', 'ADVERSE_MEDIA'],
        } as SanctionsBusinessUserRuleParameters,
        MEDIUM: {
          transactionAmountThreshold: {
            USD: 10000,
          },
          fuzziness: 20,
          ongoingScreening: false,
          screeningTypes: ['PEP', 'SANCTION', 'ADVERSE_MEDIA'],
        },
        LOW: {
          transactionAmountThreshold: {
            USD: 10000,
          },
          fuzziness: 20,
          ongoingScreening: false,
          screeningTypes: ['PEP', 'SANCTION', 'ADVERSE_MEDIA'],
        },
        VERY_LOW: {
          transactionAmountThreshold: {
            USD: 10000,
            ADA: 1000,
          },
          fuzziness: 20,
          ongoingScreening: false,
          screeningTypes: ['PEP', 'SANCTION', 'ADVERSE_MEDIA'],
        },
      },
      riskLevelActions: {
        VERY_HIGH: 'SUSPEND',
        HIGH: 'SUSPEND',
        MEDIUM: 'SUSPEND',
        LOW: 'SUSPEND',
        VERY_LOW: 'SUSPEND',
      },
      nature: 'SCREENING',
      labels: [],
      status: 'ACTIVE',
      createdAt: 1685604282954,
      updatedAt: 1688114634781,
      runCount: 340,
      hitCount: 240,
    }
  )

  transactionRules.push(
    ...ruleInstances
      .filter((ri) => {
        return ri.type === 'TRANSACTION'
      })
      .map(
        (ri, i): ExecutedRulesResult => ({
          ruleInstanceId: ri.id as string,
          ruleName: ri.ruleNameAlias as string,
          ruleAction: ri.action as RuleAction,
          ruleId: ri.ruleId as string,
          nature: ri.nature,
          ruleDescription: ri.ruleDescriptionAlias as string,
          ruleHit: true,
          ruleHitMeta: {
            falsePositiveDetails:
              random(0, 10) < 4
                ? { isFalsePositive: true, confidenceScore: random(59, 82) }
                : { isFalsePositive: false, confidenceScore: 100 },
            hitDirections: i % 2 ? ['ORIGIN'] : ['DESTINATION'],
          },
        })
      )
  )

  userRules.push(
    ...ruleInstances
      .filter((ri) => {
        return ri.type === 'USER'
      })
      .map(
        (ri, i): ExecutedRulesResult => ({
          ruleInstanceId: ri.id as string,
          ruleName: ri.ruleNameAlias as string,
          ruleAction: ri.action as RuleAction,
          ruleId: ri.ruleId as string,
          nature: ri.nature,
          ruleDescription: ri.ruleDescriptionAlias as string,
          ruleHit: true,
          ruleHitMeta: {
            falsePositiveDetails:
              random(0, 10) < 2
                ? { isFalsePositive: true, confidenceScore: random(59, 82) }
                : { isFalsePositive: false, confidenceScore: 100 },
            hitDirections: i % 2 ? ['ORIGIN'] : ['DESTINATION'],
          },
        })
      )
  )
}
export const ruleInstances: RuleInstance[] = []

export const transactionRules: ExecutedRulesResult[] = []

export const userRules: ExecutedRulesResult[] = []

export function randomTransactionRules(): ExecutedRulesResult[] {
  return cloneDeep(randomSubset(transactionRules))
}

export function randomUserRules(): ExecutedRulesResult[] {
  return cloneDeep(randomSubset(userRules))
}
