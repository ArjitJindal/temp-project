import { ExecutedRulesResult } from '@/@types/openapi-public/ExecutedRulesResult'
import { pickRandom, randomArray } from '@/utils/prng'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { RuleAction } from '@/@types/openapi-internal/RuleAction'
import { SANCTIONS_DETAILS_ENTITY_TYPES } from '@/@types/openapi-internal-custom/SanctionsDetailsEntityType'

export const ruleInstances: RuleInstance[] = [
  {
    id: 'e8c3b853',
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
    ruleId: 'R-2',
    casePriority: 'P1',
    parameters: {
      transactionAmountThreshold: {
        USD: 10000,
      },
    },
    action: 'SUSPEND',
    type: 'TRANSACTION',
    ruleNameAlias: 'Transaction amount too high',
    ruleDescriptionAlias: 'Transaction amount is >= x in PHP or equivalent',
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
    id: '2i3nflkd',
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
    runCount: 210,
    hitCount: 340,
  },
  {
    id: 'skn2ls',
    ruleId: 'R-32',
    casePriority: 'P1',
    parameters: {},
    action: 'SUSPEND',
    type: 'TRANSACTION',
    ruleNameAlias: 'Screening on Bank name',
    ruleDescriptionAlias:
      'Sanctions/PEP/Adverse media screening on Bank names. IBAN number resolution option available in rule configuration.',
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
    nature: 'SCREENING',
    labels: [],
    status: 'ACTIVE',
    createdAt: 1685604282954,
    updatedAt: 1688114634781,
    runCount: 210,
    hitCount: 340,
  },
  {
    id: '3oi3nlk',
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
    nature: 'SCREENING',
    labels: [],
    status: 'ACTIVE',
    createdAt: 1685604282954,
    updatedAt: 1688114634781,
    runCount: 210,
    hitCount: 340,
  },
]

export const rules: ExecutedRulesResult[] = ruleInstances.map((ri, i) => ({
  ruleInstanceId: ri.id as string,
  ruleName: ri.ruleNameAlias as string,
  ruleAction: ri.action as RuleAction,
  ruleId: ri.ruleId as string,
  nature: ri.nature,
  ruleDescription: ri.ruleDescriptionAlias as string,
  ruleHit: true,
  ruleHitMeta: {
    hitDirections: i % 2 ? ['ORIGIN'] : ['DESTINATION'],
    sanctionsDetails:
      ri.nature === 'SCREENING'
        ? [
            {
              name: 'John Smith',
              // IDs from the search responses in raw-data
              searchId: pickRandom([
                '229b87fa-05ab-4b1d-82f8-b2df32fdcab7',
                '6505dae6-0424-4677-935c-926317854a5f',
                'c3da5e59-b309-4916-ac21-171ccf5922bc',
              ]),
              iban: 'DE24500105178163255147',
              entityType: pickRandom(SANCTIONS_DETAILS_ENTITY_TYPES),
            },
          ]
        : undefined,
  },
}))

export function randomRules(): ExecutedRulesResult[] {
  return randomArray((i) => rules[i], 0.1, rules.length)
}
