import { cloneDeep, memoize, random } from 'lodash'
import { getRandomUser } from '../samplers/accounts'
import { getSLAPolicies } from './sla'
import { ExecutedRulesResult } from '@/@types/openapi-public/ExecutedRulesResult'
import {
  getRandomIntInclusive,
  pickRandom,
  randomSubset,
} from '@/core/seed/samplers/prng'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { RuleAction } from '@/@types/openapi-internal/RuleAction'
import { SanctionsBusinessUserRuleParameters } from '@/services/rules-engine/user-rules/sanctions-business-user'
import { SanctionsBankUserRuleParameters } from '@/services/rules-engine/user-rules/sanctions-bank-name'
import { SanctionsConsumerUserRuleParameters } from '@/services/rules-engine/user-rules/sanctions-consumer-user'
import { getChecklistTemplates } from '@/core/seed/data/checklists'
import { TransactionsVelocityRuleParameters } from '@/services/rules-engine/transaction-rules/transactions-velocity'
import { TransactionAmountRuleParameters } from '@/services/rules-engine/transaction-rules/transaction-amount'
import { LowValueTransactionsRuleParameters } from '@/services/rules-engine/transaction-rules/low-value-transactions-base'
import { SanctionsCounterPartyRuleParameters } from '@/services/rules-engine/transaction-rules/sanctions-counterparty'
import { RuleChecksForField } from '@/services/rules-engine/transaction-rules/library'
import { isShadowRule } from '@/services/rules-engine/utils'

export const getRuleInstance = (ruleInstanceId: string): RuleInstance => {
  return ruleInstances().find((ri) => ri.id === ruleInstanceId) as RuleInstance
}

export const ruleInstances: () => RuleInstance[] = memoize(() => {
  const getRuleFilter = () => {
    const max = getRandomIntInclusive(1000, 10000)
    const min = getRandomIntInclusive(1, max)
    return {
      lowTransactionCount: getRandomIntInclusive(1, 50),
      lowTransactionValues: {
        USD: {
          max,
          min,
        },
      },
    } as LowValueTransactionsRuleParameters
  }

  const r1RuleInstance: RuleInstance[] = [
    {
      id: 'R-1.7',
      type: 'TRANSACTION',
      ruleId: 'R-1',
      ruleNameAlias: 'First transaction of a user',
      ruleDescriptionAlias: 'First transaction of a user',
      filters: getRuleFilter(),
      parameters: {
        transactionAmountThreshold: {
          USD: getRandomIntInclusive(1000, 10000),
        },
      } as TransactionAmountRuleParameters,
      riskLevelParameters: {
        VERY_LOW: getRuleFilter(),
        VERY_HIGH: getRuleFilter(),
        HIGH: getRuleFilter(),
        MEDIUM: getRuleFilter(),
        LOW: getRuleFilter(),
      },
      action: 'FLAG',
      riskLevelActions: {
        VERY_LOW: 'FLAG',
        VERY_HIGH: 'FLAG',
        HIGH: 'FLAG',
        MEDIUM: 'FLAG',
        LOW: 'FLAG',
      },
      status: 'INACTIVE',
      createdAt: 1726843563672,
      updatedAt: 1729057178462,
      casePriority: 'P1',
      falsePositiveCheckEnabled: false,
      nature: 'AML',
      labels: [],
      riskLevelsTriggersOnHit: {
        VERY_LOW: {
          usersToCheck: 'ALL',
          kycStatusDetails: { reason: 'Fake document', status: 'SUCCESSFUL' },
        },
        VERY_HIGH: { usersToCheck: 'ALL' },
        HIGH: { usersToCheck: 'ALL' },
        MEDIUM: { usersToCheck: 'ALL' },
        LOW: { usersToCheck: 'ALL' },
      },
      alertConfig: {
        slaPolicies: [
          pickRandom(getSLAPolicies()).id,
          pickRandom(getSLAPolicies()).id,
          pickRandom(getSLAPolicies()).id,
        ],
        frozenStatuses: [],
        alertCreatedFor: ['USER'],
      },
      checksFor: ['1st transaction'],
      createdBy: getRandomUser().assigneeUserId,
      ruleExecutionMode: 'SYNC',
      ruleRunMode: 'LIVE',
    },
  ]
  const r1RuleInstanceShadow: RuleInstance[] = [
    {
      id: 'R-1.8',
      type: 'TRANSACTION',
      ruleId: 'R-1',
      ruleNameAlias: 'First transaction of a user (shadow)',
      ruleDescriptionAlias: 'First transaction of a user (shadow)',
      filters: getRuleFilter(),
      parameters: {
        transactionAmountThreshold: {
          USD: getRandomIntInclusive(100, 50000),
        },
      } as TransactionAmountRuleParameters,
      riskLevelParameters: {
        VERY_LOW: getRuleFilter(),
        VERY_HIGH: getRuleFilter(),
        HIGH: getRuleFilter(),
        MEDIUM: getRuleFilter(),
        LOW: getRuleFilter(),
      },
      action: 'FLAG',
      riskLevelActions: {
        VERY_LOW: 'FLAG',
        VERY_HIGH: 'FLAG',
        HIGH: 'FLAG',
        MEDIUM: 'FLAG',
        LOW: 'FLAG',
      },
      status: 'ACTIVE',
      createdAt: 1726843563672,
      updatedAt: 1729057178462,
      casePriority: 'P1',
      falsePositiveCheckEnabled: false,
      nature: 'AML',
      labels: [],
      riskLevelsTriggersOnHit: {
        VERY_LOW: {
          usersToCheck: 'ALL',
          kycStatusDetails: { reason: 'Fake document', status: 'SUCCESSFUL' },
        },
        VERY_HIGH: { usersToCheck: 'ALL' },
        HIGH: { usersToCheck: 'ALL' },
        MEDIUM: { usersToCheck: 'ALL' },
        LOW: { usersToCheck: 'ALL' },
      },
      alertConfig: {
        slaPolicies: [
          pickRandom(getSLAPolicies()).id,
          pickRandom(getSLAPolicies()).id,
          pickRandom(getSLAPolicies()).id,
        ],
        frozenStatuses: [],
        alertCreatedFor: ['USER'],
      },
      checksFor: ['1st transaction'],
      createdBy: getRandomUser().assigneeUserId,
      ruleExecutionMode: 'SYNC',
      ruleRunMode: 'SHADOW',
    },
  ]
  const r2RuleInstance: RuleInstance[] = [
    {
      id: 'Es4Zmo',
      checklistTemplateId: pickRandom(getChecklistTemplates()).id,
      ruleId: 'R-2',
      ruleRunMode: 'SHADOW',
      ruleExecutionMode: 'SYNC',
      casePriority: 'P1',
      alertConfig: {
        slaPolicies: [pickRandom(getSLAPolicies()).id],
      },
      parameters: {
        transactionAmountThreshold: {
          USD: 10000,
        },
      } as TransactionAmountRuleParameters,
      checksFor: ['Transaction amount'],
      action: 'SUSPEND',
      type: 'TRANSACTION',
      ruleNameAlias: 'Transaction amount too high (shadow)',
      ruleDescriptionAlias: 'Transaction amount is >= x in USD or equivalent',
      filters: {},
      riskLevelParameters: {
        VERY_HIGH: {
          transactionAmountThreshold: {
            USD: 10000,
          },
        } as TransactionAmountRuleParameters,
        HIGH: {
          transactionAmountThreshold: {
            USD: 10000,
          },
        } as TransactionAmountRuleParameters,
        MEDIUM: {
          transactionAmountThreshold: {
            USD: 10000,
          },
        } as TransactionAmountRuleParameters,
        LOW: {
          transactionAmountThreshold: {
            USD: 10000,
          },
        } as TransactionAmountRuleParameters,
        VERY_LOW: {
          transactionAmountThreshold: {
            USD: 10000,
            ADA: 1000,
          },
        } as TransactionAmountRuleParameters,
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
      createdBy: getRandomUser().assigneeUserId,
      types: [],
      typologies: [],
    } as RuleInstance,
  ]

  const r8RuleInstance: RuleInstance[] = [
    {
      id: 'CK4Nh2',
      ruleRunMode: 'LIVE',
      ruleExecutionMode: 'SYNC',
      checklistTemplateId: pickRandom(getChecklistTemplates()).id,
      alertConfig: {
        slaPolicies: [
          pickRandom(getSLAPolicies()).id,
          pickRandom(getSLAPolicies()).id,
        ],
      },
      ruleId: 'R-8',
      casePriority: 'P2',
      parameters: {},
      action: 'FLAG',
      type: 'TRANSACTION',
      ruleNameAlias:
        'Too many transactions under reporting limit sent by a user.',
      ruleDescriptionAlias:
        '>= ‘x’ number of consecutive low value outgoing transactions just below a threshold amount ‘y’ to a user. Often seen in structured money laundering attempts.',
      filters: {
        lowTransactionCount: 10,
        lowTransactionValues: {
          USD: {
            max: 1000,
            min: 100,
          },
        },
      } as LowValueTransactionsRuleParameters,
      riskLevelParameters: {
        VERY_HIGH: {
          lowTransactionCount: 10,
          lowTransactionValues: {
            USD: {
              max: 1000,
              min: 100,
            },
          },
        } as LowValueTransactionsRuleParameters,
        HIGH: {
          lowTransactionCount: 10,
          lowTransactionValues: {
            USD: {
              max: 1000,
              min: 100,
            },
          },
        } as LowValueTransactionsRuleParameters,
        MEDIUM: {
          lowTransactionCount: 10,
          lowTransactionValues: {
            USD: {
              max: 1000,
              min: 100,
            },
          },
        } as LowValueTransactionsRuleParameters,
        LOW: {
          lowTransactionCount: 10,
          lowTransactionValues: {
            USD: {
              max: 1000,
              min: 100,
            },
          },
        } as LowValueTransactionsRuleParameters,
        VERY_LOW: {
          lowTransactionCount: 10,
          lowTransactionValues: {
            USD: {
              max: 1000,
              min: 100,
            },
          },
        } as LowValueTransactionsRuleParameters,
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
      createdBy: getRandomUser().assigneeUserId,
      checksFor: ['Transaction amount', 'No. of transactions'],
      types: [],
      typologies: [],
    } as RuleInstance,
  ]

  const r8RuleInstanceShadow: RuleInstance[] = [
    {
      id: 'R-8.1',
      ruleRunMode: 'SHADOW',
      ruleExecutionMode: 'SYNC',
      checklistTemplateId: pickRandom(getChecklistTemplates()).id,
      alertConfig: {
        slaPolicies: [
          pickRandom(getSLAPolicies()).id,
          pickRandom(getSLAPolicies()).id,
        ],
      },
      ruleId: 'R-8',
      casePriority: 'P2',
      parameters: {},
      action: 'FLAG',
      type: 'TRANSACTION',
      ruleNameAlias:
        'Too many transactions under reporting limit sent by a user.',
      ruleDescriptionAlias:
        '>= ‘x’ number of consecutive low value outgoing transactions just below a threshold amount ‘y’ to a user. Often seen in structured money laundering attempts.',
      filters: {
        lowTransactionCount: 10,
        lowTransactionValues: {
          USD: {
            max: 1000,
            min: 100,
          },
        },
      } as LowValueTransactionsRuleParameters,
      riskLevelParameters: {
        VERY_HIGH: {
          lowTransactionCount: 10,
          lowTransactionValues: {
            USD: {
              max: 10000,
              min: 1000,
            },
          },
        } as LowValueTransactionsRuleParameters,
        HIGH: {
          lowTransactionCount: 10,
          lowTransactionValues: {
            USD: {
              max: 10000,
              min: 1000,
            },
          },
        } as LowValueTransactionsRuleParameters,
        MEDIUM: {
          lowTransactionCount: 10,
          lowTransactionValues: {
            USD: {
              max: 10000,
              min: 1000,
            },
          },
        } as LowValueTransactionsRuleParameters,
        LOW: {
          lowTransactionCount: 10,
          lowTransactionValues: {
            USD: {
              max: 10000,
              min: 1000,
            },
          },
        } as LowValueTransactionsRuleParameters,
        VERY_LOW: {
          lowTransactionCount: 10,
          lowTransactionValues: {
            USD: {
              max: 10000,
              min: 1000,
            },
          },
        } as LowValueTransactionsRuleParameters,
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
      createdBy: getRandomUser().assigneeUserId,
      checksFor: ['Transaction amount', 'No. of transactions'],
      types: [],
      typologies: [],
    } as RuleInstance,
  ]

  const r16RuleInstance: RuleInstance[] = [
    {
      id: 'hODvd2',
      checklistTemplateId: pickRandom(getChecklistTemplates()).id,
      alertConfig: {
        slaPolicies: [
          pickRandom(getSLAPolicies()).id,
          pickRandom(getSLAPolicies()).id,
        ],
      },
      ruleRunMode: 'LIVE',
      ruleExecutionMode: 'SYNC',
      ruleId: 'R-16',
      casePriority: 'P1',
      parameters: {
        fuzziness: 20,
        screeningTypes: ['PEP'],
      } as SanctionsConsumerUserRuleParameters,
      action: 'BLOCK',
      type: 'USER',
      ruleNameAlias: 'Screening on Consumer users',
      ruleDescriptionAlias:
        'Sanctions/PEP/Adverse media screening on Consumer users.',
      filters: {},
      riskLevelParameters: {
        VERY_HIGH: {
          fuzziness: 20,
          screeningTypes: ['PEP'],
        } as SanctionsConsumerUserRuleParameters,
        HIGH: {
          fuzziness: 20,
          ongoingScreening: false,
          screeningTypes: ['PEP'],
        } as SanctionsConsumerUserRuleParameters,
        MEDIUM: {
          fuzziness: 20,
          screeningTypes: ['PEP'],
        } as SanctionsConsumerUserRuleParameters,
        LOW: {
          fuzziness: 20,
          screeningTypes: ['PEP'],
        } as SanctionsConsumerUserRuleParameters,
        VERY_LOW: {
          fuzziness: 20,
          screeningTypes: ['PEP'],
        } as SanctionsConsumerUserRuleParameters,
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
      createdBy: getRandomUser().assigneeUserId,
      checksFor: ['Username', 'User’s Y.O.B'],
      types: [],
      typologies: [],
    } as RuleInstance,
  ]

  const r30RuleInstance: RuleInstance[] = [
    {
      id: 'ZnTte8',
      ruleRunMode: 'LIVE',
      ruleExecutionMode: 'SYNC',
      checklistTemplateId: pickRandom(getChecklistTemplates()).id,
      ruleId: 'R-30',
      casePriority: 'P1',
      checksFor: ['No. of transactions', 'Time'],
      parameters: {
        transactionsLimit: 10,
        timeWindow: {
          units: 1,
          granularity: 'day',
        },
        uniqueUsersCountThreshold: 10,
      } as TransactionsVelocityRuleParameters,
      action: 'FLAG',
      type: 'TRANSACTION',
      ruleNameAlias: 'High velocity user',
      ruleDescriptionAlias: 'High velocity user',
      alertConfig: {
        slaPolicies: [pickRandom(getSLAPolicies()).id],
      },
      filters: {},
      riskLevelParameters: {
        VERY_HIGH: {
          transactionsLimit: 10,
          timeWindow: {
            units: 1,
            granularity: 'day',
          },
          uniqueUsersCountThreshold: 10,
        } as TransactionsVelocityRuleParameters,
        HIGH: {
          transactionsLimit: 10,
          timeWindow: {
            units: 1,
            granularity: 'day',
          },
          uniqueUsersCountThreshold: 10,
        } as TransactionsVelocityRuleParameters,
        MEDIUM: {
          transactionsLimit: 10,
          timeWindow: {
            units: 1,
            granularity: 'day',
          },
          uniqueUsersCountThreshold: 10,
        } as TransactionsVelocityRuleParameters,
        LOW: {
          transactionsLimit: 10,
          timeWindow: {
            units: 1,
            granularity: 'day',
          },
          uniqueUsersCountThreshold: 10,
        } as TransactionsVelocityRuleParameters,
        VERY_LOW: {
          transactionsLimit: 10,
          timeWindow: {
            units: 1,
            granularity: 'day',
          },
          uniqueUsersCountThreshold: 10,
        } as TransactionsVelocityRuleParameters,
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
      createdBy: getRandomUser().assigneeUserId,
      types: [],
      typologies: [],
    } as RuleInstance,
  ]

  const r30RuleInstanceShadow: RuleInstance[] = [
    {
      id: 'R-30.1',
      ruleRunMode: 'SHADOW',
      ruleExecutionMode: 'SYNC',
      checklistTemplateId: pickRandom(getChecklistTemplates()).id,
      ruleId: 'R-30',
      casePriority: 'P1',
      checksFor: ['No. of transactions', 'Time'],
      parameters: {
        transactionsLimit: 10,
        timeWindow: {
          units: 1,
          granularity: 'day',
        },
        uniqueUsersCountThreshold: 10,
      } as TransactionsVelocityRuleParameters,
      action: 'FLAG',
      type: 'TRANSACTION',
      ruleNameAlias: 'High velocity user',
      ruleDescriptionAlias: 'High velocity user',
      alertConfig: {
        slaPolicies: [pickRandom(getSLAPolicies()).id],
      },
      filters: {},
      riskLevelParameters: {
        VERY_HIGH: {
          transactionsLimit: 15,
          timeWindow: {
            units: 1,
            granularity: 'day',
          },
          uniqueUsersCountThreshold: 15,
        } as TransactionsVelocityRuleParameters,
        HIGH: {
          transactionsLimit: 15,
          timeWindow: {
            units: 1,
            granularity: 'day',
          },
          uniqueUsersCountThreshold: 15,
        } as TransactionsVelocityRuleParameters,
        MEDIUM: {
          transactionsLimit: 15,
          timeWindow: {
            units: 1,
            granularity: 'day',
          },
          uniqueUsersCountThreshold: 15,
        } as TransactionsVelocityRuleParameters,
        LOW: {
          transactionsLimit: 15,
          timeWindow: {
            units: 1,
            granularity: 'day',
          },
          uniqueUsersCountThreshold: 15,
        } as TransactionsVelocityRuleParameters,
        VERY_LOW: {
          transactionsLimit: 15,
          timeWindow: {
            units: 1,
            granularity: 'day',
          },
          uniqueUsersCountThreshold: 15,
        } as TransactionsVelocityRuleParameters,
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
      createdBy: getRandomUser().assigneeUserId,
      types: [],
      typologies: [],
    } as RuleInstance,
  ]

  const r32RuleInstance: RuleInstance[] = [
    {
      id: 'pLRu4m',
      ruleRunMode: 'LIVE',
      ruleExecutionMode: 'SYNC',
      checklistTemplateId: pickRandom(getChecklistTemplates()).id,
      ruleId: 'R-32',
      casePriority: 'P1',
      alertConfig: {
        slaPolicies: [pickRandom(getSLAPolicies()).id],
      },
      parameters: {
        fuzziness: 20,
        ongoingScreening: false,
        screeningTypes: ['PEP'],
        resolveIban: false,
      } as SanctionsBankUserRuleParameters,
      action: 'SUSPEND',
      type: 'USER',
      ruleNameAlias: 'Screening on Bank name',
      ruleDescriptionAlias:
        'Sanctions/PEP/Adverse media screening on Bank names. IBAN number resolution option available in rule configuration.',
      filters: {},
      checksFor: ['User’s bank name'],
      riskLevelParameters: {
        VERY_HIGH: {
          fuzziness: 20,
          ongoingScreening: false,
          screeningTypes: ['PEP'],
          resolveIban: false,
        } as SanctionsBankUserRuleParameters,
        HIGH: {
          fuzziness: 20,
          ongoingScreening: false,
          screeningTypes: ['PEP'],
          resolveIban: false,
        } as SanctionsBankUserRuleParameters,
        MEDIUM: {
          fuzziness: 20,
          ongoingScreening: false,
          screeningTypes: ['PEP'],
          resolveIban: false,
        } as SanctionsBankUserRuleParameters,
        LOW: {
          fuzziness: 20,
          ongoingScreening: false,
          screeningTypes: ['PEP'],
          resolveIban: false,
        } as SanctionsBankUserRuleParameters,
        VERY_LOW: {
          fuzziness: 20,
          ongoingScreening: false,
          screeningTypes: ['PEP'],
          resolveIban: false,
        } as SanctionsBankUserRuleParameters,
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
      createdBy: getRandomUser().assigneeUserId,
      types: [],
      typologies: [],
    } as RuleInstance,
  ]

  const r56RuleInstance: RuleInstance[] = [
    {
      id: 'RC-56',
      type: 'TRANSACTION',
      ruleId: 'RC-56',
      ruleNameAlias: 'LOW -> MEDIUM & missing SoF',
      ruleDescriptionAlias: 'LOW -> MEDIUM & missing SoF',
      logic: {
        and: [
          { '==': [{ var: 'entity:34a165bb' }, 'LOW'] },
          { '!': { var: 'entity:9fe10e15' } },
        ],
      },
      riskLevelLogic: {
        VERY_LOW: {
          and: [
            { '==': [{ var: 'entity:34a165bb' }, 'LOW'] },
            { '!': { var: 'entity:9fe10e15' } },
          ],
        },
        VERY_HIGH: {
          and: [
            { '==': [{ var: 'entity:34a165bb' }, 'LOW'] },
            { '!': { var: 'entity:9fe10e15' } },
          ],
        },
        HIGH: {
          and: [
            { '==': [{ var: 'entity:34a165bb' }, 'LOW'] },
            { '!': { var: 'entity:9fe10e15' } },
          ],
        },
        MEDIUM: {
          and: [
            { '==': [{ var: 'entity:34a165bb' }, 'LOW'] },
            { '!': { var: 'entity:9fe10e15' } },
          ],
        },
        LOW: {
          and: [
            { '==': [{ var: 'entity:34a165bb' }, 'LOW'] },
            { '!': { var: 'entity:9fe10e15' } },
          ],
        },
      },
      logicEntityVariables: [
        {
          key: 'entity:34a165bb',
          entityKey: 'CONSUMER_USER:riskLevel__SENDER',
        },
        {
          key: 'entity:9fe10e15',
          entityKey: 'TRANSACTION:originFundsInfo-sourceOfFunds',
        },
      ],
      logicAggregationVariables: [],
      action: 'FLAG',
      riskLevelActions: {
        VERY_LOW: 'SUSPEND',
        VERY_HIGH: 'FLAG',
        HIGH: 'FLAG',
        MEDIUM: 'FLAG',
        LOW: 'FLAG',
      },
      status: 'INACTIVE',
      createdAt: 1727965523023,
      updatedAt: 1728987799955,
      casePriority: 'P1',
      falsePositiveCheckEnabled: false,
      nature: 'AML',
      labels: [],
      riskLevelsTriggersOnHit: {
        VERY_LOW: { usersToCheck: 'ALL' },
        VERY_HIGH: { usersToCheck: 'ALL' },
        HIGH: { usersToCheck: 'ALL' },
        MEDIUM: { usersToCheck: 'ALL' },
        LOW: { usersToCheck: 'ALL' },
      },
      alertConfig: {
        frozenStatuses: [],
        alertCreationInterval: { type: 'INSTANTLY' },
        alertCreatedFor: ['USER'],
      },
      checksFor: [],
      createdBy: getRandomUser().assigneeUserId,
      ruleExecutionMode: 'SYNC',
      ruleRunMode: 'LIVE',
    } as RuleInstance,
  ]

  const r120RuleInstance: RuleInstance[] = [
    {
      id: 'R-120.1',
      type: 'TRANSACTION',
      ruleId: 'R-120',
      ruleNameAlias: 'Average transaction amount exceed past period average',
      ruleDescriptionAlias: 'Chaning ',
      filters: {},
      logic: {
        or: [
          {
            and: [
              { '>': [{ var: 'agg:sending-b106f' }, 0] },
              {
                '>': [
                  {
                    '/': [
                      { var: 'agg:sending-93285' },
                      { var: 'agg:sending-b106f' },
                    ],
                  },
                  2,
                ],
              },
              { '<=': [5, { var: 'agg:sending-6bb6c' }, 9007199254740991] },
            ],
          },
          {
            and: [
              { '>': [{ var: 'agg:receiving-b106f' }, 0] },
              {
                '>': [
                  {
                    '/': [
                      { var: 'agg:receiving-93285' },
                      { var: 'agg:receiving-b106f' },
                    ],
                  },
                  2,
                ],
              },
              { '<=': [5, { var: 'agg:receiving-6bb6c' }, 9007199254740991] },
            ],
          },
        ],
      },
      riskLevelLogic: {
        VERY_LOW: {
          or: [
            {
              and: [
                { '>': [{ var: 'agg:sending-b106f' }, 0] },
                {
                  '>': [
                    {
                      '/': [
                        { var: 'agg:sending-93285' },
                        { var: 'agg:sending-b106f' },
                      ],
                    },
                    2,
                  ],
                },
                { '<=': [5, { var: 'agg:sending-6bb6c' }, 9007199254740991] },
              ],
            },
            {
              and: [
                { '>': [{ var: 'agg:receiving-b106f' }, 0] },
                {
                  '>': [
                    {
                      '/': [
                        { var: 'agg:receiving-93285' },
                        { var: 'agg:receiving-b106f' },
                      ],
                    },
                    2,
                  ],
                },
                { '<=': [5, { var: 'agg:receiving-6bb6c' }, 9007199254740991] },
              ],
            },
          ],
        },
        VERY_HIGH: {
          or: [
            {
              and: [
                { '>': [{ var: 'agg:sending-b106f' }, 0] },
                {
                  '>': [
                    {
                      '/': [
                        { var: 'agg:sending-93285' },
                        { var: 'agg:sending-b106f' },
                      ],
                    },
                    2,
                  ],
                },
                { '<=': [5, { var: 'agg:sending-6bb6c' }, 9007199254740991] },
              ],
            },
            {
              and: [
                { '>': [{ var: 'agg:receiving-b106f' }, 0] },
                {
                  '>': [
                    {
                      '/': [
                        { var: 'agg:receiving-93285' },
                        { var: 'agg:receiving-b106f' },
                      ],
                    },
                    2,
                  ],
                },
                { '<=': [5, { var: 'agg:receiving-6bb6c' }, 9007199254740991] },
              ],
            },
          ],
        },
        HIGH: {
          or: [
            {
              and: [
                { '>': [{ var: 'agg:sending-b106f' }, 0] },
                {
                  '>': [
                    {
                      '/': [
                        { var: 'agg:sending-93285' },
                        { var: 'agg:sending-b106f' },
                      ],
                    },
                    2,
                  ],
                },
                { '<=': [5, { var: 'agg:sending-6bb6c' }, 9007199254740991] },
              ],
            },
            {
              and: [
                { '>': [{ var: 'agg:receiving-b106f' }, 0] },
                {
                  '>': [
                    {
                      '/': [
                        { var: 'agg:receiving-93285' },
                        { var: 'agg:receiving-b106f' },
                      ],
                    },
                    2,
                  ],
                },
                { '<=': [5, { var: 'agg:receiving-6bb6c' }, 9007199254740991] },
              ],
            },
          ],
        },
        MEDIUM: {
          or: [
            {
              and: [
                { '>': [{ var: 'agg:sending-b106f' }, 0] },
                {
                  '>': [
                    {
                      '/': [
                        { var: 'agg:sending-93285' },
                        { var: 'agg:sending-b106f' },
                      ],
                    },
                    2,
                  ],
                },
                { '<=': [5, { var: 'agg:sending-6bb6c' }, 9007199254740991] },
              ],
            },
            {
              and: [
                { '>': [{ var: 'agg:receiving-b106f' }, 0] },
                {
                  '>': [
                    {
                      '/': [
                        { var: 'agg:receiving-93285' },
                        { var: 'agg:receiving-b106f' },
                      ],
                    },
                    2,
                  ],
                },
                { '<=': [5, { var: 'agg:receiving-6bb6c' }, 9007199254740991] },
              ],
            },
          ],
        },
        LOW: {
          or: [
            {
              and: [
                { '>': [{ var: 'agg:sending-b106f' }, 0] },
                {
                  '>': [
                    {
                      '/': [
                        { var: 'agg:sending-93285' },
                        { var: 'agg:sending-b106f' },
                      ],
                    },
                    2,
                  ],
                },
                { '<=': [5, { var: 'agg:sending-6bb6c' }, 9007199254740991] },
              ],
            },
            {
              and: [
                { '>': [{ var: 'agg:receiving-b106f' }, 0] },
                {
                  '>': [
                    {
                      '/': [
                        { var: 'agg:receiving-93285' },
                        { var: 'agg:receiving-b106f' },
                      ],
                    },
                    2,
                  ],
                },
                { '<=': [5, { var: 'agg:receiving-6bb6c' }, 9007199254740991] },
              ],
            },
          ],
        },
      },
      logicAggregationVariables: [
        {
          aggregationFieldKey:
            'TRANSACTION:originAmountDetails-transactionAmount',
          aggregationFunc: 'AVG',
          timeWindow: {
            start: { granularity: 'day', units: 1 },
            end: { granularity: 'now', units: 0 },
          },
          userDirection: 'SENDER',
          type: 'USER_TRANSACTIONS',
          transactionDirection: 'SENDING',
          includeCurrentEntity: true,
          version: 1729169864383,
          key: 'agg:sending-93285',
          baseCurrency: 'EUR',
        },
        {
          aggregationFieldKey:
            'TRANSACTION:destinationAmountDetails-transactionAmount',
          aggregationFunc: 'AVG',
          timeWindow: {
            start: { granularity: 'day', units: 1 },
            end: { granularity: 'now', units: 0 },
          },
          userDirection: 'RECEIVER',
          type: 'USER_TRANSACTIONS',
          transactionDirection: 'RECEIVING',
          includeCurrentEntity: true,
          version: 1729169864383,
          key: 'agg:receiving-93285',
          baseCurrency: 'EUR',
        },
        {
          aggregationFieldKey:
            'TRANSACTION:originAmountDetails-transactionAmount',
          aggregationFunc: 'AVG',
          timeWindow: {
            start: { granularity: 'day', units: 2 },
            end: { granularity: 'now', units: 0 },
          },
          userDirection: 'SENDER',
          type: 'USER_TRANSACTIONS',
          transactionDirection: 'SENDING',
          includeCurrentEntity: true,
          version: 1729169864384,
          key: 'agg:sending-b106f',
          baseCurrency: 'EUR',
        },
        {
          aggregationFieldKey:
            'TRANSACTION:destinationAmountDetails-transactionAmount',
          aggregationFunc: 'AVG',
          timeWindow: {
            start: { granularity: 'day', units: 2 },
            end: { granularity: 'now', units: 0 },
          },
          userDirection: 'RECEIVER',
          type: 'USER_TRANSACTIONS',
          transactionDirection: 'RECEIVING',
          includeCurrentEntity: true,
          version: 1729169864396,
          key: 'agg:receiving-b106f',
          baseCurrency: 'EUR',
        },
        {
          aggregationFieldKey: 'TRANSACTION:transactionId',
          aggregationFunc: 'COUNT',
          timeWindow: {
            start: { granularity: 'day', units: 2 },
            end: { granularity: 'now', units: 0 },
          },
          userDirection: 'SENDER',
          type: 'USER_TRANSACTIONS',
          transactionDirection: 'SENDING',
          includeCurrentEntity: true,
          version: 1729169864397,
          key: 'agg:sending-6bb6c',
        },
        {
          aggregationFieldKey: 'TRANSACTION:transactionId',
          aggregationFunc: 'COUNT',
          timeWindow: {
            start: { granularity: 'day', units: 2 },
            end: { granularity: 'now', units: 0 },
          },
          userDirection: 'RECEIVER',
          type: 'USER_TRANSACTIONS',
          transactionDirection: 'RECEIVING',
          includeCurrentEntity: true,
          version: 1729169864397,
          key: 'agg:receiving-6bb6c',
        },
      ],
      parameters: {
        period2: { granularity: 'day', units: 2 },
        period1: { granularity: 'day', units: 1 },
        transactionsNumberThreshold2: { min: 5 },
        multiplierThreshold: { value: 200, currency: 'EUR' },
        checkSender: 'sending',
        checkReceiver: 'receiving',
      },
      riskLevelParameters: {
        VERY_LOW: {
          period2: { granularity: 'day', units: 2 },
          period1: { granularity: 'day', units: 1 },
          transactionsNumberThreshold2: { min: 5 },
          multiplierThreshold: { value: 200, currency: 'EUR' },
          checkSender: 'sending',
          checkReceiver: 'receiving',
        },
        VERY_HIGH: {
          period2: { granularity: 'day', units: 2 },
          period1: { granularity: 'day', units: 1 },
          transactionsNumberThreshold2: { min: 5 },
          multiplierThreshold: { value: 200, currency: 'EUR' },
          checkSender: 'sending',
          checkReceiver: 'receiving',
        },
        HIGH: {
          period2: { granularity: 'day', units: 2 },
          period1: { granularity: 'day', units: 1 },
          transactionsNumberThreshold2: { min: 5 },
          multiplierThreshold: { value: 200, currency: 'EUR' },
          checkSender: 'sending',
          checkReceiver: 'receiving',
        },
        MEDIUM: {
          period2: { granularity: 'day', units: 2 },
          period1: { granularity: 'day', units: 1 },
          transactionsNumberThreshold2: { min: 5 },
          multiplierThreshold: { value: 200, currency: 'EUR' },
          checkSender: 'sending',
          checkReceiver: 'receiving',
        },
        LOW: {
          period2: { granularity: 'day', units: 2 },
          period1: { granularity: 'day', units: 1 },
          transactionsNumberThreshold2: { min: 5 },
          multiplierThreshold: { value: 200, currency: 'EUR' },
          checkSender: 'sending',
          checkReceiver: 'receiving',
        },
      },
      action: 'FLAG',
      riskLevelActions: {
        VERY_LOW: 'FLAG',
        VERY_HIGH: 'FLAG',
        HIGH: 'FLAG',
        MEDIUM: 'FLAG',
        LOW: 'FLAG',
      },
      status: 'INACTIVE',
      createdAt: 1729169864382,
      updatedAt: 1731388464109,
      casePriority: 'P1',
      falsePositiveCheckEnabled: true,
      nature: 'FRAUD',
      labels: [],
      alertConfig: { frozenStatuses: [], alertCreatedFor: ['USER'] },
      checksFor: ['Transaction amount', 'Time'],
      createdBy: getRandomUser().assigneeUserId,
      ruleExecutionMode: 'SYNC',
      ruleRunMode: 'LIVE',
    } as RuleInstance,
  ]

  const r128RuleInstance: RuleInstance[] = [
    {
      id: 'FlWDkd',
      ruleRunMode: 'LIVE',
      ruleExecutionMode: 'SYNC',
      checklistTemplateId: pickRandom(getChecklistTemplates()).id,
      alertConfig: {
        slaPolicies: [
          pickRandom(getSLAPolicies()).id,
          pickRandom(getSLAPolicies()).id,
        ],
      },
      ruleId: 'R-128',
      casePriority: 'P1',
      parameters: {
        fuzziness: 20,
        ongoingScreening: false,
        screeningTypes: ['PEP', 'SANCTIONS', 'ADVERSE_MEDIA'],
        entityTypes: ['LEGAL_NAME'],
      } as SanctionsBusinessUserRuleParameters,
      action: 'SUSPEND',
      checksFor: ['Entity name'],
      type: 'USER',
      ruleNameAlias:
        'Screening on Business legal entity & shareholders & directors',
      ruleDescriptionAlias:
        'Sanctions/PEP/Adverse media screening on Business legal entity & shareholders & directors',
      filters: {},
      riskLevelParameters: {
        VERY_HIGH: {
          entityTypes: ['LEGAL_NAME'],
          fuzziness: 20,
          ongoingScreening: false,
          screeningTypes: ['PEP', 'SANCTIONS', 'ADVERSE_MEDIA'],
        } as SanctionsBusinessUserRuleParameters,
        HIGH: {
          fuzziness: 20,
          ongoingScreening: false,
          screeningTypes: ['PEP', 'SANCTIONS', 'ADVERSE_MEDIA'],
          entityTypes: ['LEGAL_NAME'],
        } as SanctionsBusinessUserRuleParameters,
        MEDIUM: {
          fuzziness: 20,
          ongoingScreening: false,
          screeningTypes: ['PEP', 'SANCTIONS', 'ADVERSE_MEDIA'],
          entityTypes: ['LEGAL_NAME'],
        } as SanctionsBusinessUserRuleParameters,
        LOW: {
          fuzziness: 20,
          ongoingScreening: false,
          screeningTypes: ['PEP', 'SANCTIONS', 'ADVERSE_MEDIA'],
          entityTypes: ['LEGAL_NAME'],
        } as SanctionsBusinessUserRuleParameters,
        VERY_LOW: {
          fuzziness: 20,
          ongoingScreening: false,
          screeningTypes: ['PEP', 'SANCTIONS', 'ADVERSE_MEDIA'],
          entityTypes: ['LEGAL_NAME'],
        } as SanctionsBusinessUserRuleParameters,
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
      createdBy: getRandomUser().assigneeUserId,
      types: [],
      typologies: [],
    } as RuleInstance,
  ]

  const r121RuleInstance: RuleInstance[] = [
    {
      id: 'R-121.1',
      type: 'TRANSACTION',
      ruleId: 'R-121',
      ruleNameAlias:
        'Average transactions number exceed past period average number',
      ruleDescriptionAlias: 'Testing',
      filters: {},
      logic: {
        or: [
          {
            and: [
              { '>': [{ '/': [{ var: 'agg:sending-e9545' }, 2] }, 0] },
              {
                '>': [
                  {
                    '/': [
                      { '/': [{ var: 'agg:sending-542c1' }, 1] },
                      { '/': [{ var: 'agg:sending-e9545' }, 2] },
                    ],
                  },
                  2,
                ],
              },
              { '<=': [5, { var: 'agg:sending-6bb6c' }, 9007199254740991] },
            ],
          },
          {
            and: [
              { '>': [{ '/': [{ var: 'agg:receiving-e9545' }, 2] }, 0] },
              {
                '>': [
                  {
                    '/': [
                      { '/': [{ var: 'agg:receiving-542c1' }, 1] },
                      { '/': [{ var: 'agg:receiving-e9545' }, 2] },
                    ],
                  },
                  2,
                ],
              },
              { '<=': [5, { var: 'agg:receiving-6bb6c' }, 9007199254740991] },
            ],
          },
        ],
      },
      riskLevelLogic: {
        VERY_LOW: {
          or: [
            {
              and: [
                { '>': [{ '/': [{ var: 'agg:sending-e9545' }, 2] }, 0] },
                {
                  '>': [
                    {
                      '/': [
                        { '/': [{ var: 'agg:sending-542c1' }, 1] },
                        { '/': [{ var: 'agg:sending-e9545' }, 2] },
                      ],
                    },
                    2,
                  ],
                },
                { '<=': [5, { var: 'agg:sending-6bb6c' }, 9007199254740991] },
              ],
            },
            {
              and: [
                { '>': [{ '/': [{ var: 'agg:receiving-e9545' }, 2] }, 0] },
                {
                  '>': [
                    {
                      '/': [
                        { '/': [{ var: 'agg:receiving-542c1' }, 1] },
                        { '/': [{ var: 'agg:receiving-e9545' }, 2] },
                      ],
                    },
                    2,
                  ],
                },
                { '<=': [5, { var: 'agg:receiving-6bb6c' }, 9007199254740991] },
              ],
            },
          ],
        },
        VERY_HIGH: {
          or: [
            {
              and: [
                { '>': [{ '/': [{ var: 'agg:sending-e9545' }, 2] }, 0] },
                {
                  '>': [
                    {
                      '/': [
                        { '/': [{ var: 'agg:sending-542c1' }, 1] },
                        { '/': [{ var: 'agg:sending-e9545' }, 2] },
                      ],
                    },
                    2,
                  ],
                },
                { '<=': [5, { var: 'agg:sending-6bb6c' }, 9007199254740991] },
              ],
            },
            {
              and: [
                { '>': [{ '/': [{ var: 'agg:receiving-e9545' }, 2] }, 0] },
                {
                  '>': [
                    {
                      '/': [
                        { '/': [{ var: 'agg:receiving-542c1' }, 1] },
                        { '/': [{ var: 'agg:receiving-e9545' }, 2] },
                      ],
                    },
                    2,
                  ],
                },
                { '<=': [5, { var: 'agg:receiving-6bb6c' }, 9007199254740991] },
              ],
            },
          ],
        },
        HIGH: {
          or: [
            {
              and: [
                { '>': [{ '/': [{ var: 'agg:sending-e9545' }, 2] }, 0] },
                {
                  '>': [
                    {
                      '/': [
                        { '/': [{ var: 'agg:sending-542c1' }, 1] },
                        { '/': [{ var: 'agg:sending-e9545' }, 2] },
                      ],
                    },
                    2,
                  ],
                },
                { '<=': [5, { var: 'agg:sending-6bb6c' }, 9007199254740991] },
              ],
            },
            {
              and: [
                { '>': [{ '/': [{ var: 'agg:receiving-e9545' }, 2] }, 0] },
                {
                  '>': [
                    {
                      '/': [
                        { '/': [{ var: 'agg:receiving-542c1' }, 1] },
                        { '/': [{ var: 'agg:receiving-e9545' }, 2] },
                      ],
                    },
                    2,
                  ],
                },
                { '<=': [5, { var: 'agg:receiving-6bb6c' }, 9007199254740991] },
              ],
            },
          ],
        },
        MEDIUM: {
          or: [
            {
              and: [
                { '>': [{ '/': [{ var: 'agg:sending-e9545' }, 2] }, 0] },
                {
                  '>': [
                    {
                      '/': [
                        { '/': [{ var: 'agg:sending-542c1' }, 1] },
                        { '/': [{ var: 'agg:sending-e9545' }, 2] },
                      ],
                    },
                    2,
                  ],
                },
                { '<=': [5, { var: 'agg:sending-6bb6c' }, 9007199254740991] },
              ],
            },
            {
              and: [
                { '>': [{ '/': [{ var: 'agg:receiving-e9545' }, 2] }, 0] },
                {
                  '>': [
                    {
                      '/': [
                        { '/': [{ var: 'agg:receiving-542c1' }, 1] },
                        { '/': [{ var: 'agg:receiving-e9545' }, 2] },
                      ],
                    },
                    2,
                  ],
                },
                { '<=': [5, { var: 'agg:receiving-6bb6c' }, 9007199254740991] },
              ],
            },
          ],
        },
        LOW: {
          or: [
            {
              and: [
                { '>': [{ '/': [{ var: 'agg:sending-e9545' }, 2] }, 0] },
                {
                  '>': [
                    {
                      '/': [
                        { '/': [{ var: 'agg:sending-542c1' }, 1] },
                        { '/': [{ var: 'agg:sending-e9545' }, 2] },
                      ],
                    },
                    2,
                  ],
                },
                { '<=': [5, { var: 'agg:sending-6bb6c' }, 9007199254740991] },
              ],
            },
            {
              and: [
                { '>': [{ '/': [{ var: 'agg:receiving-e9545' }, 2] }, 0] },
                {
                  '>': [
                    {
                      '/': [
                        { '/': [{ var: 'agg:receiving-542c1' }, 1] },
                        { '/': [{ var: 'agg:receiving-e9545' }, 2] },
                      ],
                    },
                    2,
                  ],
                },
                { '<=': [5, { var: 'agg:receiving-6bb6c' }, 9007199254740991] },
              ],
            },
          ],
        },
      },
      logicAggregationVariables: [
        {
          aggregationFieldKey: 'TRANSACTION:transactionId',
          aggregationFunc: 'COUNT',
          timeWindow: {
            start: { granularity: 'day', units: 1 },
            end: { granularity: 'now', units: 0 },
          },
          userDirection: 'SENDER',
          type: 'USER_TRANSACTIONS',
          transactionDirection: 'SENDING',
          includeCurrentEntity: true,
          version: 1729498903540,
          key: 'agg:sending-542c1',
        },
        {
          aggregationFieldKey: 'TRANSACTION:transactionId',
          aggregationFunc: 'COUNT',
          timeWindow: {
            start: { granularity: 'day', units: 1 },
            end: { granularity: 'now', units: 0 },
          },
          userDirection: 'RECEIVER',
          type: 'USER_TRANSACTIONS',
          transactionDirection: 'RECEIVING',
          includeCurrentEntity: true,
          version: 1729498903541,
          key: 'agg:receiving-542c1',
        },
        {
          aggregationFieldKey: 'TRANSACTION:transactionId',
          aggregationFunc: 'COUNT',
          timeWindow: {
            start: { granularity: 'day', units: 2 },
            end: { granularity: 'now', units: 0 },
          },
          userDirection: 'SENDER',
          type: 'USER_TRANSACTIONS',
          transactionDirection: 'SENDING',
          includeCurrentEntity: true,
          version: 1729169864397,
          key: 'agg:sending-e9545',
        },
        {
          aggregationFieldKey: 'TRANSACTION:transactionId',
          aggregationFunc: 'COUNT',
          timeWindow: {
            start: { granularity: 'day', units: 2 },
            end: { granularity: 'now', units: 0 },
          },
          userDirection: 'RECEIVER',
          type: 'USER_TRANSACTIONS',
          transactionDirection: 'RECEIVING',
          includeCurrentEntity: true,
          version: 1729169864397,
          key: 'agg:receiving-e9545',
        },
      ],
      parameters: {
        period2: { granularity: 'day', units: 2 },
        period1: { granularity: 'day', units: 1 },
        transactionsNumberThreshold2: { min: 5 },
        multiplierThreshold: 200,
        checkSender: 'sending',
        checkReceiver: 'receiving',
      },
      riskLevelParameters: {
        VERY_LOW: {
          period2: { granularity: 'day', units: 2 },
          period1: { granularity: 'day', units: 1 },
          transactionsNumberThreshold2: { min: 5 },
          multiplierThreshold: 200,
          checkSender: 'sending',
          checkReceiver: 'receiving',
        },
        VERY_HIGH: {
          period2: { granularity: 'day', units: 2 },
          period1: { granularity: 'day', units: 1 },
          transactionsNumberThreshold2: { min: 5 },
          multiplierThreshold: 200,
          checkSender: 'sending',
          checkReceiver: 'receiving',
        },
        HIGH: {
          period2: { granularity: 'day', units: 2 },
          period1: { granularity: 'day', units: 1 },
          transactionsNumberThreshold2: { min: 5 },
          multiplierThreshold: 200,
          checkSender: 'sending',
          checkReceiver: 'receiving',
        },
        MEDIUM: {
          period2: { granularity: 'day', units: 2 },
          period1: { granularity: 'day', units: 1 },
          transactionsNumberThreshold2: { min: 5 },
          multiplierThreshold: 200,
          checkSender: 'sending',
          checkReceiver: 'receiving',
        },
        LOW: {
          period2: { granularity: 'day', units: 2 },
          period1: { granularity: 'day', units: 1 },
          transactionsNumberThreshold2: { min: 5 },
          multiplierThreshold: 200,
          checkSender: 'sending',
          checkReceiver: 'receiving',
        },
      },
      action: 'FLAG',
      riskLevelActions: {
        VERY_LOW: 'FLAG',
        VERY_HIGH: 'FLAG',
        HIGH: 'FLAG',
        MEDIUM: 'FLAG',
        LOW: 'FLAG',
      },
      status: 'INACTIVE',
      createdAt: 1729498903527,
      updatedAt: 1730824618379,
      casePriority: 'P1',
      falsePositiveCheckEnabled: false,
      nature: 'FRAUD',
      labels: [],
      alertConfig: { frozenStatuses: [], alertCreatedFor: ['USER'] },
      checksFor: ['No. of transactions', 'Time'],
      createdBy: getRandomUser().assigneeUserId,
      ruleExecutionMode: 'SYNC',
      ruleRunMode: 'LIVE',
    } as RuleInstance,
  ]

  const r169RuleInstance: RuleInstance[] = [
    {
      id: '0a1QSr',
      ruleRunMode: 'LIVE',
      ruleExecutionMode: 'SYNC',
      checklistTemplateId: pickRandom(getChecklistTemplates()).id,
      alertConfig: {
        slaPolicies: [
          pickRandom(getSLAPolicies()).id,
          pickRandom(getSLAPolicies()).id,
          pickRandom(getSLAPolicies()).id,
        ],
      },
      ruleId: 'R-169',
      casePriority: 'P1',
      parameters: {
        fuzziness: 20,
        ongoingScreening: false,
        screeningTypes: ['PEP', 'SANCTIONS', 'ADVERSE_MEDIA'],
        resolveIban: false,
      } as SanctionsCounterPartyRuleParameters,
      action: 'SUSPEND',
      checksFor: [
        RuleChecksForField.CounterpartyUsername,
        RuleChecksForField.CounterpartyBankName,
      ],
      type: 'TRANSACTION',
      ruleNameAlias: 'Tx’s counterparty screening',
      ruleDescriptionAlias:
        'Screening transaction’s counterparty for Sanctions/PEP/Adverse media',
      filters: {},
      riskLevelParameters: {
        VERY_HIGH: {
          fuzziness: 20,
          screeningTypes: ['PEP', 'SANCTIONS', 'ADVERSE_MEDIA'],
        } as SanctionsCounterPartyRuleParameters,
        HIGH: {
          fuzziness: 20,
          screeningTypes: ['PEP', 'SANCTIONS', 'ADVERSE_MEDIA'],
        } as SanctionsCounterPartyRuleParameters,
        MEDIUM: {
          fuzziness: 20,
          screeningTypes: ['PEP', 'SANCTIONS', 'ADVERSE_MEDIA'],
        } as SanctionsCounterPartyRuleParameters,
        LOW: {
          fuzziness: 20,
          screeningTypes: ['PEP', 'SANCTIONS', 'ADVERSE_MEDIA'],
        } as SanctionsCounterPartyRuleParameters,
        VERY_LOW: {
          fuzziness: 20,
          screeningTypes: ['PEP', 'SANCTIONS', 'ADVERSE_MEDIA'],
        } as SanctionsCounterPartyRuleParameters,
      },
      riskLevelActions: {
        VERY_HIGH: 'FLAG',
        HIGH: 'FLAG',
        MEDIUM: 'FLAG',
        LOW: 'FLAG',
        VERY_LOW: 'FLAG',
      },
      nature: 'SCREENING',
      labels: [],
      status: 'ACTIVE',
      createdAt: 1685604282954,
      updatedAt: 1688114634781,
      createdBy: getRandomUser().assigneeUserId,
      types: [],
      typologies: [],
    } as RuleInstance,
  ]

  const r169RuleInstanceShadow: RuleInstance[] = [
    {
      id: 'R-169.1',
      ruleRunMode: 'SHADOW',
      ruleExecutionMode: 'SYNC',
      checklistTemplateId: pickRandom(getChecklistTemplates()).id,
      alertConfig: {
        slaPolicies: [
          pickRandom(getSLAPolicies()).id,
          pickRandom(getSLAPolicies()).id,
          pickRandom(getSLAPolicies()).id,
        ],
      },
      ruleId: 'R-169',
      casePriority: 'P1',
      parameters: {
        fuzziness: 20,
        ongoingScreening: false,
        screeningTypes: ['PEP', 'SANCTIONS', 'ADVERSE_MEDIA'],
        resolveIban: false,
      } as SanctionsCounterPartyRuleParameters,
      action: 'SUSPEND',
      checksFor: [
        RuleChecksForField.CounterpartyUsername,
        RuleChecksForField.CounterpartyBankName,
      ],
      type: 'TRANSACTION',
      ruleNameAlias: 'Tx’s counterparty screening',
      ruleDescriptionAlias:
        'Screening transaction’s counterparty for Sanctions/PEP/Adverse media',
      filters: {},
      riskLevelParameters: {
        VERY_HIGH: {
          fuzziness: 20,
          screeningTypes: ['PEP', 'SANCTIONS', 'ADVERSE_MEDIA'],
        } as SanctionsCounterPartyRuleParameters,
        HIGH: {
          fuzziness: 20,
          screeningTypes: ['PEP', 'SANCTIONS', 'ADVERSE_MEDIA'],
        } as SanctionsCounterPartyRuleParameters,
        MEDIUM: {
          fuzziness: 20,
          screeningTypes: ['PEP', 'SANCTIONS', 'ADVERSE_MEDIA'],
        } as SanctionsCounterPartyRuleParameters,
        LOW: {
          fuzziness: 20,
          screeningTypes: ['PEP', 'SANCTIONS', 'ADVERSE_MEDIA'],
        } as SanctionsCounterPartyRuleParameters,
        VERY_LOW: {
          fuzziness: 20,
          screeningTypes: ['PEP', 'SANCTIONS', 'ADVERSE_MEDIA'],
        } as SanctionsCounterPartyRuleParameters,
      },
      riskLevelActions: {
        VERY_HIGH: 'FLAG',
        HIGH: 'FLAG',
        MEDIUM: 'FLAG',
        LOW: 'FLAG',
        VERY_LOW: 'FLAG',
      },
      nature: 'SCREENING',
      labels: [],
      status: 'ACTIVE',
      createdAt: 1685604282954,
      updatedAt: 1688114634781,
      createdBy: getRandomUser().assigneeUserId,
      types: [],
      typologies: [],
    } as RuleInstance,
  ]

  const data = [
    ...r1RuleInstance,
    ...r2RuleInstance,
    ...r8RuleInstance,
    ...r16RuleInstance,
    ...r30RuleInstance,
    ...r32RuleInstance,
    ...r56RuleInstance,
    ...r120RuleInstance,
    ...r121RuleInstance,
    ...r128RuleInstance,
    ...r169RuleInstance,
    ...r1RuleInstanceShadow,
    ...r169RuleInstanceShadow,
    ...r8RuleInstanceShadow,
    ...r30RuleInstanceShadow,
  ]

  return data
})

export const transactionRules: (
  hitRuleIds?: string[]
) => ExecutedRulesResult[] = memoize((hitRuleIds) => {
  return ruleInstances()
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
        ruleHit: hitRuleIds?.includes(ri.id ?? '') ?? true,
        ruleHitMeta: {
          falsePositiveDetails:
            random(0, 10) < 4
              ? { isFalsePositive: true, confidenceScore: random(59, 82) }
              : { isFalsePositive: false, confidenceScore: 100 },
          hitDirections: i % 2 ? ['ORIGIN'] : ['DESTINATION'],
        },
        isShadow: isShadowRule(ri),
      })
    )
})

export const userRules: (hitRuleIds?: string[]) => ExecutedRulesResult[] =
  memoize((hitRuleIds) => {
    return ruleInstances()
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
          ruleHit: hitRuleIds?.includes(ri.id ?? '') ?? true,
          ruleHitMeta: {
            falsePositiveDetails:
              random(0, 10) < 2
                ? { isFalsePositive: true, confidenceScore: random(59, 82) }
                : { isFalsePositive: false, confidenceScore: 100 },
            hitDirections: i % 2 ? ['ORIGIN'] : ['DESTINATION'],
          },
          isShadow: isShadowRule(ri),
        })
      )
  })

export function randomTransactionRules(): ExecutedRulesResult[] {
  return cloneDeep(randomSubset(transactionRules()))
}

export function randomUserRules(): ExecutedRulesResult[] {
  return cloneDeep(randomSubset(userRules()))
}
