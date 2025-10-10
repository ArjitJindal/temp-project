import { v4 as uuid4 } from 'uuid'
import { BaseSampler } from './base'
import { AuditLog } from '@/@types/openapi-internal/AuditLog'
import { getAccounts } from '@/core/seed/samplers/accounts'

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000

export class RuleAuditLogSampler extends BaseSampler<AuditLog> {
  protected generateSample(): AuditLog {
    return {
      auditlogId: uuid4(),
      user: this.rng.r(2).pickRandom(getAccounts()),
      type: 'RULE',
      entityId: 'R-13.1',
      action: 'CREATE',
      timestamp: this.rng.randomTimestamp(THIRTY_DAYS),
      newImage: {
        id: 'RC-415',
        ruleId: 'RC-415',
        casePriority: 'P1',
        alertCreationOnHit: true,
        riskLevelLogic: {
          VERY_HIGH: {
            and: [
              {
                '!=': [
                  {
                    var: 'entity:cd861774',
                  },
                  null,
                ],
              },
            ],
          },
          HIGH: {
            and: [
              {
                '!=': [
                  {
                    var: 'entity:cd861774',
                  },
                  'KI',
                ],
              },
            ],
          },
          MEDIUM: {
            and: [
              {
                '==': [
                  {
                    var: 'entity:cd861774',
                  },
                  'MA',
                ],
              },
            ],
          },
          LOW: {
            and: [
              {
                '==': [
                  {
                    var: 'entity:cd861774',
                  },
                  'RU',
                ],
              },
            ],
          },
          VERY_LOW: {
            and: [
              {
                '==': [
                  {
                    var: 'entity:cd861774',
                  },
                  'AF',
                ],
              },
            ],
          },
        },
        logicAggregationVariables: [],
        logicMachineLearningVariables: [],
        logicEntityVariables: [
          {
            key: 'entity:b1c37206',
            entityKey: 'TRANSACTION:type',
          },
          {
            key: 'entity:cd861774',
            entityKey: 'TRANSACTION:originAmountDetails-country',
          },
        ],
        type: 'TRANSACTION',
        ruleNameAlias: 'test audit log',
        ruleDescriptionAlias: 'test audit log',
        riskLevelActions: {
          VERY_HIGH: 'FLAG',
          HIGH: 'FLAG',
          MEDIUM: 'FLAG',
          LOW: 'FLAG',
          VERY_LOW: 'FLAG',
        },
        riskLevelsTriggersOnHit: {
          VERY_HIGH: {
            usersToCheck: 'ALL',
          },
          HIGH: {
            usersToCheck: 'ALL',
          },
          MEDIUM: {
            usersToCheck: 'ALL',
          },
          LOW: {
            usersToCheck: 'ALL',
          },
          VERY_LOW: {
            usersToCheck: 'ALL',
          },
        },
        nature: 'AML',
        labels: [],
        status: 'ACTIVE',
        createdAt: 1748532077526,
        updatedAt: 1748532717444,
        runCount: 0,
        hitCount: 0,
        falsePositiveCheckEnabled: false,
        alertConfig: {
          alertCreationInterval: {
            type: 'INSTANTLY',
          },
          alertCreatedFor: ['USER'],
          frozenStatuses: [],
        },
        checksFor: [],
        createdBy: 'auth0|678cf38c19da2dd304a952a9',
        ruleRunMode: 'LIVE',
        ruleExecutionMode: 'SYNC',
      },
      oldImage: {
        id: 'RC-415',
        type: 'TRANSACTION',
        ruleId: 'RC-415',
        ruleNameAlias: 'test audit log',
        ruleDescriptionAlias: 'test audit log',
        riskLevelLogic: {
          VERY_LOW: {
            and: [
              {
                '==': [
                  {
                    var: 'entity:cd861774',
                  },
                  'AF',
                ],
              },
            ],
          },
          VERY_HIGH: {
            and: [
              {
                '==': [
                  {
                    var: 'entity:cd861774',
                  },
                  'AF',
                ],
              },
            ],
          },
          HIGH: {
            and: [
              {
                '==': [
                  {
                    var: 'entity:cd861774',
                  },
                  'AF',
                ],
              },
            ],
          },
          MEDIUM: {
            and: [
              {
                '==': [
                  {
                    var: 'entity:cd861774',
                  },
                  'AF',
                ],
              },
            ],
          },
          LOW: {
            and: [
              {
                '==': [
                  {
                    var: 'entity:cd861774',
                  },
                  'AF',
                ],
              },
            ],
          },
        },
        logicEntityVariables: [
          {
            key: 'entity:b1c37206',
            entityKey: 'TRANSACTION:type',
          },
          {
            key: 'entity:cd861774',
            entityKey: 'TRANSACTION:originAmountDetails-country',
          },
        ],
        logicAggregationVariables: [],
        riskLevelActions: {
          VERY_LOW: 'FLAG',
          VERY_HIGH: 'FLAG',
          HIGH: 'FLAG',
          MEDIUM: 'FLAG',
          LOW: 'FLAG',
        },
        status: 'ACTIVE',
        createdAt: 1748532077526,
        updatedAt: 1748532077526,
        runCount: 0,
        hitCount: 0,
        casePriority: 'P1',
        falsePositiveCheckEnabled: false,
        nature: 'AML',
        labels: [],
        riskLevelsTriggersOnHit: {
          VERY_LOW: {
            usersToCheck: 'ALL',
          },
          VERY_HIGH: {
            usersToCheck: 'ALL',
          },
          HIGH: {
            usersToCheck: 'ALL',
          },
          MEDIUM: {
            usersToCheck: 'ALL',
          },
          LOW: {
            usersToCheck: 'ALL',
          },
        },
        alertConfig: {
          frozenStatuses: [],
          alertCreationInterval: {
            type: 'INSTANTLY',
          },
          alertCreatedFor: ['USER'],
        },
        checksFor: [],
        createdBy: 'auth0|678cf38c19da2dd304a952a9',
        ruleExecutionMode: 'SYNC',
        ruleRunMode: 'LIVE',
        alertCreationOnHit: true,
      },
      logMetadata: {
        ruleId: 'RC-415',
        id: 'RC-415',
      },
    }
  }
}

export class RiskFactorAuditLogSampler extends BaseSampler<AuditLog> {
  protected generateSample(): AuditLog {
    return {
      auditlogId: uuid4(),
      timestamp: this.rng.randomTimestamp(THIRTY_DAYS),
      user: this.rng.r(2).pickRandom(getAccounts()),
      type: 'RISK_FACTOR',
      subtype: 'RISK_FACTOR_V8',
      action: 'CREATE',
      newImage: {
        defaultRiskLevel: 'HIGH',
        defaultRiskScore: 71.5,
        defaultWeight: 0.5,
        description: 'test audit log',
        status: 'ACTIVE',
        logicAggregationVariables: [],
        logicEntityVariables: [
          {
            key: 'entity:6c315556',
            entityKey: 'CONSUMER_USER:userDetails-placeOfBirth-country__SENDER',
          },
        ],
        name: 'test audit log',
        type: 'CONSUMER_USER',
        riskLevelLogic: [
          {
            logic: {
              and: [
                {
                  '==': [
                    {
                      var: 'entity:6c315556',
                    },
                    'RU',
                  ],
                },
              ],
            },
            riskScore: 71.5,
            riskLevel: 'HIGH',
            weight: 0.27,
          },
        ],
        id: 'RF-153',
        createdAt: 1748518789448,
        updatedAt: 1748518789448,
      },
      entityId: 'RF-153',
    }
  }
}
