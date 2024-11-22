import { uniqBy } from 'lodash'
import { getRiskLevelFromScore } from '@flagright/lib/utils/risk'
import { MongoClient } from 'mongodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { RiskRepository } from '../risk-scoring/repositories/risk-repository'
import { RiskScoringV8Service } from '../risk-scoring/risk-scoring-v8-service'
import { UserRepository } from '../users/repositories/user-repository'
import { sendWebhookTasks } from '../webhook/utils'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'
import { HitRulesDetails } from '@/@types/openapi-internal/HitRulesDetails'
import { UserRiskScoreDetails } from '@/@types/openapi-internal/UserRiskScoreDetails'
import { RiskLevel } from '@/@types/openapi-internal/RiskLevel'
import { User } from '@/@types/openapi-internal/User'
import { UserUpdateRequest } from '@/@types/openapi-internal/UserUpdateRequest'
import { UserTag } from '@/@types/openapi-internal/UserTag'

export const PNB_INTERNAL_RULES: RuleInstance[] = [
  {
    id: 'pnb-internal-trigger-incomplete-risk-levels',
    type: 'USER',
    ruleNameAlias: 'PNB - Trigger to return incomplete risk levels',
    ruleDescriptionAlias: 'Trigger to return incomplete risk levels',
    logic: {
      and: [
        {
          '!': {
            var: 'entity:user_id',
          },
        },
      ],
    },
    riskLevelLogic: {
      VERY_LOW: {
        and: [
          {
            '!': {
              var: 'entity:user_id',
            },
          },
        ],
      },
      VERY_HIGH: {
        and: [
          {
            '!': {
              var: 'entity:user_id',
            },
          },
        ],
      },
      HIGH: {
        and: [
          {
            '!': {
              var: 'entity:user_id',
            },
          },
        ],
      },
      MEDIUM: {
        and: [
          {
            or: [
              {
                '==': [
                  {
                    var: 'entity:user_previous_cra_level',
                  },
                  null,
                ],
              },
              {
                '==': [
                  {
                    var: 'entity:user_previous_cra_level',
                  },
                  'LOW',
                ],
              },
              {
                '==': [
                  {
                    var: 'entity:user_previous_cra_level',
                  },
                  'VERY_LOW',
                ],
              },
              {
                some: [
                  {
                    var: 'entity:consumer_user_tags__sender',
                  },
                  {
                    and: [
                      {
                        '==': [
                          {
                            var: 'key',
                          },
                          'RISK_LEVEL_STATUS',
                        ],
                      },
                      {
                        '==': [
                          {
                            var: 'value',
                          },
                          'Incomplete',
                        ],
                      },
                      {
                        '==': [
                          {
                            var: 'isEditable',
                          },
                          true,
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      LOW: {
        and: [
          {
            or: [
              {
                '==': [
                  {
                    var: 'entity:user_previous_cra_level',
                  },
                  null,
                ],
              },
              {
                '==': [
                  {
                    var: 'entity:user_previous_cra_level',
                  },
                  'VERY_LOW',
                ],
              },
              {
                some: [
                  {
                    var: 'entity:consumer_user_tags__sender',
                  },
                  {
                    and: [
                      {
                        '==': [
                          {
                            var: 'key',
                          },
                          'RISK_LEVEL_STATUS',
                        ],
                      },
                      {
                        '==': [
                          {
                            var: 'value',
                          },
                          'Incomplete',
                        ],
                      },
                      {
                        '==': [
                          {
                            var: 'isEditable',
                          },
                          true,
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    },
    logicEntityVariables: [
      {
        key: 'entity:consumer_user_tags__sender',
        entityKey: 'CONSUMER_USER:tags__SENDER',
      },
      {
        key: 'entity:user_previous_cra_level',
        entityKey: 'USER:userPreviousCRALevel__SENDER',
      },
      {
        key: 'entity:user_id',
        entityKey: 'CONSUMER_USER:userId__SENDER',
      },
    ],
    logicAggregationVariables: [],
    action: 'FLAG',
    riskLevelActions: {
      VERY_LOW: 'FLAG',
      VERY_HIGH: 'FLAG',
      HIGH: 'FLAG',
      MEDIUM: 'FLAG',
      LOW: 'FLAG',
    },
    status: 'ACTIVE',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    casePriority: 'P1',
    falsePositiveCheckEnabled: false,
    nature: 'AML',
    labels: [],
    riskLevelsTriggersOnHit: {
      VERY_LOW: {
        usersToCheck: 'ALL',
        tags: [
          {
            isEditable: true,
            value: 'Incomplete',
            key: 'RISK_LEVEL_STATUS',
          },
        ],
      },
      VERY_HIGH: {
        usersToCheck: 'ALL',
        tags: [
          {
            isEditable: true,
            value: 'Incomplete',
            key: 'RISK_LEVEL_STATUS',
          },
        ],
      },
      HIGH: {
        usersToCheck: 'ALL',
        tags: [
          {
            isEditable: true,
            value: 'Incomplete',
            key: 'RISK_LEVEL_STATUS',
          },
        ],
      },
      MEDIUM: {
        usersToCheck: 'ALL',
        tags: [
          {
            isEditable: true,
            value: 'Incomplete',
            key: 'RISK_LEVEL_STATUS',
          },
        ],
      },
      LOW: {
        usersToCheck: 'ALL',
        tags: [
          {
            isEditable: true,
            value: 'Incomplete',
            key: 'RISK_LEVEL_STATUS',
          },
        ],
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
    userRuleRunCondition: {
      entityUpdated: true,
    },
    logicMachineLearningVariables: [],
    ruleExecutionMode: 'SYNC',
    ruleRunMode: 'LIVE',
    alertCreationOnHit: false,
  },
  {
    id: 'pnb-internal-trigger-incomplete-risk-levels-origin-user',
    type: 'TRANSACTION',
    ruleNameAlias: 'PNB - Trigger to return incomplete risk levels origin user',
    ruleDescriptionAlias:
      'Trigger to return incomplete risk levels origin user',
    logic: {
      and: [
        {
          '!': {
            var: 'entity:transaction_id',
          },
        },
      ],
    },
    riskLevelLogic: {
      VERY_LOW: {
        and: [
          {
            '!': {
              var: 'entity:transaction_id',
            },
          },
        ],
      },
      VERY_HIGH: {
        and: [
          {
            '!': {
              var: 'entity:transaction_id',
            },
          },
        ],
      },
      HIGH: {
        and: [
          {
            '!': {
              var: 'entity:transaction_id',
            },
          },
        ],
      },
      MEDIUM: {
        and: [
          {
            '==': [
              {
                var: 'entity:transaction_type',
              },
              'DEPOSIT',
            ],
          },
          {
            or: [
              {
                and: [
                  {
                    '!': {
                      var: 'entity:transaction_origin_funds_info_source_of_wealth',
                    },
                  },
                  {
                    '!': {
                      var: 'entity:transaction_origin_funds_info_source_of_funds',
                    },
                  },
                ],
              },
              {
                '!=': [
                  {
                    var: 'entity:transaction_state',
                  },
                  'SUCCESSFUL',
                ],
              },
            ],
          },
          {
            '==': [
              {
                var: 'entity:user_cra_level__sender',
              },
              'MEDIUM',
            ],
          },
          {
            or: [
              {
                '==': [
                  {
                    var: 'entity:user_previous_cra_level__sender',
                  },
                  null,
                ],
              },
              {
                '==': [
                  {
                    var: 'entity:user_previous_cra_level__sender',
                  },
                  'VERY_LOW',
                ],
              },
              {
                '==': [
                  {
                    var: 'entity:user_previous_cra_level__sender',
                  },
                  'LOW',
                ],
              },
              {
                some: [
                  {
                    var: 'entity:consumer_user_tags__sender',
                  },
                  {
                    and: [
                      {
                        '==': [
                          {
                            var: 'key',
                          },
                          'RISK_LEVEL_STATUS',
                        ],
                      },
                      {
                        '==': [
                          {
                            var: 'value',
                          },
                          'Incomplete',
                        ],
                      },
                      {
                        '==': [
                          {
                            var: 'isEditable',
                          },
                          true,
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      LOW: {
        and: [
          {
            '==': [
              {
                var: 'entity:transaction_type',
              },
              'DEPOSIT',
            ],
          },
          {
            or: [
              {
                and: [
                  {
                    '!': {
                      var: 'entity:transaction_origin_funds_info_source_of_wealth',
                    },
                  },
                  {
                    '!': {
                      var: 'entity:transaction_origin_funds_info_source_of_funds',
                    },
                  },
                ],
              },
              {
                '!=': [
                  {
                    var: 'entity:transaction_state',
                  },
                  'SUCCESSFUL',
                ],
              },
            ],
          },
          {
            '==': [
              {
                var: 'entity:user_cra_level__sender',
              },
              'LOW',
            ],
          },
          {
            or: [
              {
                '==': [
                  {
                    var: 'entity:user_previous_cra_level__sender',
                  },
                  null,
                ],
              },
              {
                '==': [
                  {
                    var: 'entity:user_previous_cra_level__sender',
                  },
                  'VERY_LOW',
                ],
              },
              {
                some: [
                  {
                    var: 'entity:consumer_user_tags__sender',
                  },
                  {
                    and: [
                      {
                        '==': [
                          {
                            var: 'key',
                          },
                          'RISK_LEVEL_STATUS',
                        ],
                      },
                      {
                        '==': [
                          {
                            var: 'value',
                          },
                          'Incomplete',
                        ],
                      },
                      {
                        '==': [
                          {
                            var: 'isEditable',
                          },
                          true,
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    },
    logicEntityVariables: [
      {
        key: 'entity:consumer_user_tags__sender',
        entityKey: 'CONSUMER_USER:tags__SENDER',
      },
      {
        key: 'entity:transaction_state',
        entityKey: 'TRANSACTION:transactionState',
      },
      {
        key: 'entity:transaction_type',
        entityKey: 'TRANSACTION:type',
      },
      {
        key: 'entity:transaction_id',
        entityKey: 'TRANSACTION:transactionId',
      },
      {
        key: 'entity:transaction_origin_funds_info_source_of_wealth',
        entityKey: 'TRANSACTION:originFundsInfo-sourceOfWealth',
      },
      {
        key: 'entity:transaction_origin_funds_info_source_of_funds',
        entityKey: 'TRANSACTION:originFundsInfo-sourceOfFunds',
      },
      {
        key: 'entity:user_cra_level__sender',
        entityKey: 'USER:userCRALevel__SENDER',
      },
      {
        key: 'entity:user_previous_cra_level__sender',
        entityKey: 'USER:userPreviousCRALevel__SENDER',
      },
    ],
    logicAggregationVariables: [],
    action: 'FLAG',
    riskLevelActions: {
      VERY_LOW: 'FLAG',
      VERY_HIGH: 'FLAG',
      HIGH: 'FLAG',
      MEDIUM: 'FLAG',
      LOW: 'FLAG',
    },
    status: 'ACTIVE',
    createdAt: Date.now(),
    updatedAt: Date.now(),
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
        usersToCheck: 'ORIGIN',
        tags: [
          {
            isEditable: true,
            value: 'Incomplete',
            key: 'RISK_LEVEL_STATUS',
          },
        ],
      },
      LOW: {
        usersToCheck: 'ORIGIN',
        tags: [
          {
            isEditable: true,
            value: 'Incomplete',
            key: 'RISK_LEVEL_STATUS',
          },
        ],
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
    logicMachineLearningVariables: [],
    ruleExecutionMode: 'SYNC',
    ruleRunMode: 'LIVE',
    alertCreationOnHit: false,
    ruleRunFor: 'SENDER',
  },
  {
    id: 'pnb-internal-trigger-incomplete-risk-levels-destination-user',
    type: 'TRANSACTION',
    ruleNameAlias:
      'PNB - Trigger to return incomplete risk levels destination user',
    ruleDescriptionAlias:
      'Trigger to return incomplete risk levels destination user',
    logic: {
      and: [
        {
          '!': {
            var: 'entity:transaction_id',
          },
        },
      ],
    },
    riskLevelLogic: {
      VERY_LOW: {
        and: [
          {
            '!': {
              var: 'entity:transaction_id',
            },
          },
        ],
      },
      VERY_HIGH: {
        and: [
          {
            '!': {
              var: 'entity:transaction_id',
            },
          },
        ],
      },
      HIGH: {
        and: [
          {
            '!': {
              var: 'entity:transaction_id',
            },
          },
        ],
      },
      MEDIUM: {
        and: [
          {
            '==': [
              {
                var: 'entity:transaction_type',
              },
              'DEPOSIT',
            ],
          },
          {
            or: [
              {
                and: [
                  {
                    '!': {
                      var: 'entity:transaction_origin_funds_info_source_of_wealth',
                    },
                  },
                  {
                    '!': {
                      var: 'entity:transaction_origin_funds_info_source_of_funds',
                    },
                  },
                ],
              },
              {
                '!=': [
                  {
                    var: 'entity:transaction_state',
                  },
                  'SUCCESSFUL',
                ],
              },
            ],
          },
          {
            '==': [
              {
                var: 'entity:user_cra_level__receiver',
              },
              'MEDIUM',
            ],
          },
          {
            or: [
              {
                '==': [
                  {
                    var: 'entity:user_previous_cra_level__receiver',
                  },
                  null,
                ],
              },
              {
                '==': [
                  {
                    var: 'entity:user_previous_cra_level__receiver',
                  },
                  'VERY_LOW',
                ],
              },
              {
                '==': [
                  {
                    var: 'entity:user_previous_cra_level__receiver',
                  },
                  'LOW',
                ],
              },
              {
                some: [
                  {
                    var: 'entity:consumer_user_tags__receiver',
                  },
                  {
                    and: [
                      {
                        '==': [
                          {
                            var: 'key',
                          },
                          'RISK_LEVEL_STATUS',
                        ],
                      },
                      {
                        '==': [
                          {
                            var: 'value',
                          },
                          'Incomplete',
                        ],
                      },
                      {
                        '==': [
                          {
                            var: 'isEditable',
                          },
                          true,
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      LOW: {
        and: [
          {
            '==': [
              {
                var: 'entity:transaction_type',
              },
              'DEPOSIT',
            ],
          },
          {
            or: [
              {
                and: [
                  {
                    '!': {
                      var: 'entity:transaction_origin_funds_info_source_of_wealth',
                    },
                  },
                  {
                    '!': {
                      var: 'entity:transaction_origin_funds_info_source_of_funds',
                    },
                  },
                ],
              },
              {
                '!=': [
                  {
                    var: 'entity:transaction_state',
                  },
                  'SUCCESSFUL',
                ],
              },
            ],
          },
          {
            '==': [
              {
                var: 'entity:user_cra_level__receiver',
              },
              'LOW',
            ],
          },
          {
            or: [
              {
                '==': [
                  {
                    var: 'entity:user_previous_cra_level__receiver',
                  },
                  null,
                ],
              },
              {
                '==': [
                  {
                    var: 'entity:user_previous_cra_level__receiver',
                  },
                  'VERY_LOW',
                ],
              },
              {
                some: [
                  {
                    var: 'entity:consumer_user_tags__receiver',
                  },
                  {
                    and: [
                      {
                        '==': [
                          {
                            var: 'key',
                          },
                          'RISK_LEVEL_STATUS',
                        ],
                      },
                      {
                        '==': [
                          {
                            var: 'value',
                          },
                          'Incomplete',
                        ],
                      },
                      {
                        '==': [
                          {
                            var: 'isEditable',
                          },
                          true,
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    },
    logicEntityVariables: [
      {
        key: 'entity:consumer_user_tags__receiver',
        entityKey: 'CONSUMER_USER:tags__RECEIVER',
      },
      {
        key: 'entity:transaction_state',
        entityKey: 'TRANSACTION:transactionState',
      },
      {
        key: 'entity:transaction_type',
        entityKey: 'TRANSACTION:type',
      },
      {
        key: 'entity:transaction_id',
        entityKey: 'TRANSACTION:transactionId',
      },
      {
        key: 'entity:transaction_origin_funds_info_source_of_wealth',
        entityKey: 'TRANSACTION:originFundsInfo-sourceOfWealth',
      },
      {
        key: 'entity:transaction_origin_funds_info_source_of_funds',
        entityKey: 'TRANSACTION:originFundsInfo-sourceOfFunds',
      },
      {
        key: 'entity:user_cra_level__receiver',
        entityKey: 'USER:userCRALevel__RECEIVER',
      },
      {
        key: 'entity:user_previous_cra_level__receiver',
        entityKey: 'USER:userPreviousCRALevel__RECEIVER',
      },
    ],
    logicAggregationVariables: [],
    action: 'FLAG',
    riskLevelActions: {
      VERY_LOW: 'FLAG',
      VERY_HIGH: 'FLAG',
      HIGH: 'FLAG',
      MEDIUM: 'FLAG',
      LOW: 'FLAG',
    },
    status: 'ACTIVE',
    createdAt: Date.now(),
    updatedAt: Date.now(),
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
        usersToCheck: 'DESTINATION',
        tags: [
          {
            isEditable: true,
            value: 'Incomplete',
            key: 'RISK_LEVEL_STATUS',
          },
        ],
      },
      LOW: {
        usersToCheck: 'DESTINATION',
        tags: [
          {
            isEditable: true,
            value: 'Incomplete',
            key: 'RISK_LEVEL_STATUS',
          },
        ],
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
    ruleExecutionMode: 'SYNC',
    ruleRunMode: 'LIVE',
    alertCreationOnHit: false,
    ruleRunFor: 'RECEIVER',
  },
  {
    id: 'pnb-internal-trigger-complete-risk-levels-origin-user',
    type: 'TRANSACTION',
    ruleNameAlias: 'PNB - Trigger to return complete risk levels origin user',
    ruleDescriptionAlias: 'Trigger to return complete risk levels origin user',
    logic: {
      and: [
        {
          '!': {
            var: 'entity:transaction_id',
          },
        },
      ],
    },
    riskLevelLogic: {
      VERY_LOW: {
        and: [
          {
            '!': {
              var: 'entity:transaction_id',
            },
          },
        ],
      },
      VERY_HIGH: {
        and: [
          {
            '!': {
              var: 'entity:transaction_id',
            },
          },
        ],
      },
      HIGH: {
        and: [
          {
            '!': {
              var: 'entity:transaction_id',
            },
          },
        ],
      },
      MEDIUM: {
        and: [
          {
            '==': [
              {
                var: 'entity:transaction_type',
              },
              'DEPOSIT',
            ],
          },
          {
            '==': [
              {
                var: 'entity:transaction_state',
              },
              'SUCCESSFUL',
            ],
          },
          {
            or: [
              {
                '!!': {
                  var: 'entity:originFundsInfo-sourceOfFunds',
                },
              },
              {
                '!!': {
                  var: 'entity:originFundsInfo-sourceOfWealth',
                },
              },
            ],
          },
          {
            '==': [
              {
                var: 'entity:user_cra_level__sender',
              },
              'MEDIUM',
            ],
          },
        ],
      },
      LOW: {
        and: [
          {
            '==': [
              {
                var: 'entity:transaction_type',
              },
              'DEPOSIT',
            ],
          },
          {
            '==': [
              {
                var: 'entity:transaction_state',
              },
              'SUCCESSFUL',
            ],
          },
          {
            or: [
              {
                '!!': {
                  var: 'entity:originFundsInfo-sourceOfFunds',
                },
              },
              {
                '!!': {
                  var: 'entity:originFundsInfo-sourceOfWealth',
                },
              },
            ],
          },
          {
            '==': [
              {
                var: 'entity:user_cra_level__sender',
              },
              'LOW',
            ],
          },
        ],
      },
    },
    logicEntityVariables: [
      {
        key: 'entity:transaction_state',
        entityKey: 'TRANSACTION:transactionState',
      },
      {
        key: 'entity:transaction_type',
        entityKey: 'TRANSACTION:type',
      },
      {
        key: 'entity:transaction_id',
        entityKey: 'TRANSACTION:transactionId',
      },
      {
        key: 'entity:originFundsInfo-sourceOfFunds',
        entityKey: 'TRANSACTION:originFundsInfo-sourceOfFunds',
      },
      {
        key: 'entity:originFundsInfo-sourceOfWealth',
        entityKey: 'TRANSACTION:originFundsInfo-sourceOfWealth',
      },
      {
        key: 'entity:user_cra_level__sender',
        entityKey: 'USER:userCRALevel__SENDER',
      },
    ],
    logicAggregationVariables: [],
    action: 'FLAG',
    riskLevelActions: {
      VERY_LOW: 'FLAG',
      VERY_HIGH: 'FLAG',
      HIGH: 'FLAG',
      MEDIUM: 'FLAG',
      LOW: 'FLAG',
    },
    status: 'ACTIVE',
    createdAt: Date.now(),
    updatedAt: Date.now(),
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
        usersToCheck: 'ORIGIN',
        tags: [
          {
            isEditable: true,
            value: 'Complete',
            key: 'RISK_LEVEL_STATUS',
          },
        ],
      },
      LOW: {
        usersToCheck: 'ORIGIN',
        tags: [
          {
            isEditable: true,
            value: 'Complete',
            key: 'RISK_LEVEL_STATUS',
          },
        ],
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
    logicMachineLearningVariables: [],
    ruleExecutionMode: 'SYNC',
    ruleRunMode: 'LIVE',
    alertCreationOnHit: false,
    ruleRunFor: 'SENDER',
  },
  {
    id: 'pnb-internal-trigger-complete-risk-levels-destination-user',
    type: 'TRANSACTION',
    ruleNameAlias:
      'PNB - Trigger to return complete risk levels destination user',
    ruleDescriptionAlias:
      'Trigger to return complete risk levels destination user',
    logic: {
      and: [
        {
          '!': {
            var: 'entity:transaction_id',
          },
        },
      ],
    },
    riskLevelLogic: {
      VERY_LOW: {
        and: [
          {
            '!': {
              var: 'entity:transaction_id',
            },
          },
        ],
      },
      VERY_HIGH: {
        and: [
          {
            '!': {
              var: 'entity:transaction_id',
            },
          },
        ],
      },
      HIGH: {
        and: [
          {
            '!': {
              var: 'entity:transaction_id',
            },
          },
        ],
      },
      MEDIUM: {
        and: [
          {
            '==': [
              {
                var: 'entity:transaction_type',
              },
              'DEPOSIT',
            ],
          },
          {
            '==': [
              {
                var: 'entity:transaction_state',
              },
              'SUCCESSFUL',
            ],
          },
          {
            or: [
              {
                '!!': {
                  var: 'entity:originFundsInfo-sourceOfFunds',
                },
              },
              {
                '!!': {
                  var: 'entity:originFundsInfo-sourceOfWealth',
                },
              },
            ],
          },
          {
            '==': [
              {
                var: 'entity:user_cra_level__receiver',
              },
              'MEDIUM',
            ],
          },
        ],
      },
      LOW: {
        and: [
          {
            '==': [
              {
                var: 'entity:transaction_type',
              },
              'DEPOSIT',
            ],
          },
          {
            '==': [
              {
                var: 'entity:transaction_state',
              },
              'SUCCESSFUL',
            ],
          },
          {
            or: [
              {
                '!!': {
                  var: 'entity:originFundsInfo-sourceOfFunds',
                },
              },
              {
                '!!': {
                  var: 'entity:originFundsInfo-sourceOfWealth',
                },
              },
            ],
          },
          {
            '==': [
              {
                var: 'entity:user_cra_level__receiver',
              },
              'LOW',
            ],
          },
        ],
      },
    },
    logicEntityVariables: [
      {
        key: 'entity:transaction_state',
        entityKey: 'TRANSACTION:transactionState',
      },
      {
        key: 'entity:transaction_type',
        entityKey: 'TRANSACTION:type',
      },
      {
        key: 'entity:transaction_id',
        entityKey: 'TRANSACTION:transactionId',
      },
      {
        key: 'entity:originFundsInfo-sourceOfFunds',
        entityKey: 'TRANSACTION:originFundsInfo-sourceOfFunds',
      },
      {
        key: 'entity:originFundsInfo-sourceOfWealth',
        entityKey: 'TRANSACTION:originFundsInfo-sourceOfWealth',
      },
      {
        key: 'entity:user_cra_level__receiver',
        entityKey: 'USER:userCRALevel__RECEIVER',
      },
    ],
    logicAggregationVariables: [],
    action: 'FLAG',
    riskLevelActions: {
      VERY_LOW: 'FLAG',
      VERY_HIGH: 'FLAG',
      HIGH: 'FLAG',
      MEDIUM: 'FLAG',
      LOW: 'FLAG',
    },
    status: 'ACTIVE',
    createdAt: Date.now(),
    updatedAt: Date.now(),
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
        usersToCheck: 'DESTINATION',
        tags: [
          {
            isEditable: true,
            value: 'Complete',
            key: 'RISK_LEVEL_STATUS',
          },
        ],
      },
      LOW: {
        usersToCheck: 'DESTINATION',
        tags: [
          {
            isEditable: true,
            value: 'Complete',
            key: 'RISK_LEVEL_STATUS',
          },
        ],
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
    logicMachineLearningVariables: [],
    ruleExecutionMode: 'SYNC',
    ruleRunMode: 'LIVE',
    alertCreationOnHit: false,
    ruleRunFor: 'RECEIVER',
  },
]

export const getInternalRules = (): RuleInstance[] => {
  return PNB_INTERNAL_RULES
}

export function filterOutInternalRules<T>(rules: T[]) {
  return rules.filter(
    (rule) =>
      !PNB_INTERNAL_RULES.find(
        (internalRule) => internalRule.id === rule['ruleInstanceId']
      )
  )
}

export function getUserRiskScoreDetailsForPNB(
  hitRules: HitRulesDetails[],
  userRiskScoreDetails: UserRiskScoreDetails
): UserRiskScoreDetails {
  const craLevel = userRiskScoreDetails?.craRiskLevel
  if (
    hitRules.some(
      (rule) =>
        rule.ruleInstanceId === 'pnb-internal-trigger-incomplete-risk-levels'
    )
  ) {
    return {
      ...userRiskScoreDetails,
      craRiskLevel: craLevel
        ? craLevel === 'LOW'
          ? 'HIGH'
          : 'VERY_HIGH'
        : craLevel,
    }
  }
  return userRiskScoreDetails
}

export function getTransactionRiskScoreDetailsForPNB(
  hitRules: HitRulesDetails[],
  userRiskScoreDetails:
    | {
        originUserCraRiskLevel?: RiskLevel
        destinationUserCraRiskLevel?: RiskLevel
        originUserCraRiskScore?: number
        destinationUserCraRiskScore?: number
      }
    | undefined
) {
  let riskScoreDetails = userRiskScoreDetails
  if (
    hitRules.some(
      (rule) =>
        rule.ruleInstanceId ===
        'pnb-internal-trigger-incomplete-risk-levels-origin-user'
    )
  ) {
    const craLevel = userRiskScoreDetails?.originUserCraRiskLevel
    riskScoreDetails = {
      ...riskScoreDetails,
      originUserCraRiskLevel: craLevel
        ? craLevel === 'LOW'
          ? 'HIGH'
          : 'VERY_HIGH'
        : craLevel,
    }
  }
  if (
    hitRules.some(
      (rule) =>
        rule.ruleInstanceId ===
        'pnb-internal-trigger-incomplete-risk-levels-destination-user'
    )
  ) {
    const craLevel = userRiskScoreDetails?.destinationUserCraRiskLevel
    riskScoreDetails = {
      ...riskScoreDetails,
      destinationUserCraRiskLevel: craLevel
        ? craLevel === 'LOW'
          ? 'HIGH'
          : 'VERY_HIGH'
        : craLevel,
    }
  }
  return riskScoreDetails
}

export function getRiskLevelForPNB(
  oldRiskLevel: RiskLevel | undefined,
  newRiskLevel: RiskLevel,
  user: User
) {
  const RISK_LEVEL_STATUS = user.tags?.find(
    (tag) => tag.key === 'RISK_LEVEL_STATUS'
  )?.value
  if (oldRiskLevel === 'VERY_LOW' && newRiskLevel === 'LOW') {
    return 'HIGH'
  }
  if (
    (oldRiskLevel === 'LOW' || oldRiskLevel === 'VERY_LOW') &&
    newRiskLevel === 'MEDIUM'
  ) {
    return 'VERY_HIGH'
  }
  if (
    oldRiskLevel === 'MEDIUM' &&
    newRiskLevel === 'LOW' &&
    RISK_LEVEL_STATUS === 'Incomplete'
  ) {
    return 'HIGH'
  }

  return newRiskLevel
}

// Remove conflicting rules and merge the rest
export function mergeRulesForPNB<T extends { ruleInstanceId: string }>(
  existingRules: T[],
  newRules: T[]
) {
  return uniqBy(
    (newRules ?? []).concat(
      existingRules.filter(
        (rule) =>
          !newRules.some(
            (newRule) =>
              newRule.ruleInstanceId === CONFLICTING_RULES[rule.ruleInstanceId]
          )
      ) ?? []
    ),
    (r) => r.ruleInstanceId
  )
}

function getRiskLevelForPNBFromTags(riskLevel: RiskLevel, tags: UserTag[]) {
  const riskLevelStatus = tags.find(
    (tag) => tag.key === 'RISK_LEVEL_STATUS'
  )?.value
  if (riskLevelStatus === 'Incomplete' && riskLevel !== 'VERY_LOW') {
    return riskLevel === 'LOW' ? 'HIGH' : 'VERY_HIGH'
  }
  return riskLevel
}

export async function handleInternalTagUpdateForPNB({
  user,
  updateRequest,
  userRepository,
  riskScoringV8Service,
  mongoDb,
  dynamoDb,
}: {
  user: User
  updateRequest: UserUpdateRequest
  userRepository: UserRepository
  riskScoringV8Service: RiskScoringV8Service
  mongoDb: MongoClient
  dynamoDb: DynamoDBDocumentClient
}) {
  const userDrsScore = await riskScoringV8Service.getDrsScore(user.userId)
  if (userDrsScore && userDrsScore.prevDrsScore) {
    const riskRepository = new RiskRepository(userRepository.tenantId, {
      mongoDb: mongoDb,
      dynamoDb: dynamoDb,
    })
    const riskClassificationValues =
      await riskRepository.getRiskClassificationValues()
    const currentRiskLevel = getRiskLevelFromScore(
      riskClassificationValues,
      userDrsScore.drsScore
    )
    const previousRiskLevel = getRiskLevelFromScore(
      riskClassificationValues,
      userDrsScore.prevDrsScore
    )
    const previousRiskLevelForPnb = getRiskLevelForPNBFromTags(
      previousRiskLevel,
      user.tags ?? []
    )
    const currentRiskLevelForPnb = getRiskLevelForPNBFromTags(
      currentRiskLevel,
      updateRequest.tags ?? []
    )
    if (
      currentRiskLevel === previousRiskLevel &&
      currentRiskLevelForPnb !== previousRiskLevelForPnb
    ) {
      await sendWebhookTasks(userRepository.tenantId, [
        {
          event: 'CRA_RISK_LEVEL_UPDATED',
          payload: {
            riskLevel: getRiskLevelForPNB(previousRiskLevel, currentRiskLevel, {
              ...user,
              tags: updateRequest.tags,
            }),
            userId: user.userId,
          },
          triggeredBy: 'SYSTEM',
        },
      ])
    }
  }
}

const CONFLICTING_RULES = {
  'pnb-internal-trigger-complete-risk-levels-origin-user':
    'pnb-internal-trigger-incomplete-risk-levels-origin-user',
  'pnb-internal-trigger-complete-risk-levels-destination-user':
    'pnb-internal-trigger-incomplete-risk-levels-destination-user',
  'pnb-internal-trigger-incomplete-risk-levels-origin-user':
    'pnb-internal-trigger-complete-risk-levels-origin-user',
  'pnb-internal-trigger-incomplete-risk-levels-destination-user':
    'pnb-internal-trigger-complete-risk-levels-destination-user',
}
