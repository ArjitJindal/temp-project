import { v4 as uuidv4 } from 'uuid'
import { RiskScoringService } from '../../..'
import { RiskScoringV8Service } from '../../../risk-scoring-v8-service'
import { DEFAULT_CLASSIFICATION_SETTINGS } from '../../../repositories/risk-repository'
import { getRiskFactorLogicByKeyAndType } from '../../index'
import { TRANSACTION_CONSUMER_USER_AGE_PLATFORM_RISK_FACTOR } from '../consumer-user-age-platform'
import { TEST_TRANSACTION_RISK_PARAMETERS } from '@/test-utils/pulse-test-utils'
import { getTestUser } from '@/test-utils/user-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import {
  LogicEvaluator,
  TransactionLogicData,
} from '@/services/logic-evaluator/engine'
import { RiskFactor } from '@/@types/openapi-internal/RiskFactor'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'
import {
  getTestTransaction,
  getTestTransactionEvent,
} from '@/test-utils/transaction-test-utils'
import { RiskFactorParameter } from '@/@types/openapi-internal/RiskFactorParameter'
import { RiskParameterLevelKeyValue } from '@/@types/openapi-internal/all'

dynamoDbSetupHook()
describe('Consumer User Age Platform TRANSACTION Risk Factor', () => {
  const tenantId = getTestTenantId()
  test('V8 result should be equivalent to V2 result', async () => {
    const riskFactor = {
      ...TEST_TRANSACTION_RISK_PARAMETERS[0],
      parameter: 'consumerCreatedTimestamp' as RiskFactorParameter,
      isDerived: true,
      riskLevelAssignmentValues: [
        {
          parameterValue: {
            content: {
              start: 0,
              end: 12,
              startGranularity: 'DAYS',
              kind: 'DAY_RANGE',
              endGranularity: 'DAYS',
            },
          },
          riskValue: {
            type: 'RISK_LEVEL',
            value: 'MEDIUM',
          },
        },
      ] as RiskParameterLevelKeyValue[],
    }

    const v8RiskFactor: RiskFactor = {
      id: 'TEST_FACTOR',
      ...TRANSACTION_CONSUMER_USER_AGE_PLATFORM_RISK_FACTOR,
      riskLevelLogic: (
        getRiskFactorLogicByKeyAndType(
          'consumerCreatedTimestamp',
          'TRANSACTION'
        ) ?? (() => [])
      )({
        riskLevelAssignmentValues: riskFactor.riskLevelAssignmentValues,
        riskClassificationValues: DEFAULT_CLASSIFICATION_SETTINGS,
        defaultWeight: 0.5,
      }),
      defaultRiskScore: 90,
      logicAggregationVariables: [],
      logicEntityVariables: [],
      status: 'ACTIVE',
    }

    const transaction: TransactionLogicData = {
      transaction: {
        ...getTestTransaction({
          type: 'DEPOSIT',
          timestamp: 1715145600,
          transactionId: uuidv4(),
          destinationAmountDetails: {
            country: 'DE',
            transactionAmount: 800,
            transactionCurrency: 'INR',
          },
        }),
      },
      transactionEvents: [getTestTransactionEvent()],
      senderUser: getTestUser({
        type: 'CONSUMER',
        createdTimestamp: 1715145600,
      }),
      receiverUser: getTestUser({
        type: 'CONSUMER',
        createdTimestamp: 1715145600,
      }),
      type: 'TRANSACTION',
    }
    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()
    const riskScoringV2Service = new RiskScoringService(tenantId, {
      mongoDb,
      dynamoDb,
    })
    const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
    const riskScoringV8Service = new RiskScoringV8Service(
      tenantId,
      logicEvaluator,
      {
        mongoDb,
        dynamoDb,
      }
    )
    const v2Result = await riskScoringV2Service.simulateArsScore(
      transaction.transaction,
      DEFAULT_CLASSIFICATION_SETTINGS,
      [riskFactor]
    )
    const v8Result = await riskScoringV8Service.calculateRiskFactorScore(
      v8RiskFactor,
      {
        transaction: transaction.transaction,
        transactionEvents: transaction.transactionEvents,
        senderUser: transaction.senderUser,
        receiverUser: transaction.receiverUser,
        type: 'TRANSACTION',
      }
    )
    expect(v2Result.score).toEqual(v8Result.score)
  })
  test('V8 result should handle null consumerCreatedTimestamp', async () => {
    const riskFactor = {
      ...TEST_TRANSACTION_RISK_PARAMETERS[0],
      parameter: 'consumerCreatedTimestamp' as RiskFactorParameter,
      isDerived: true,
      riskLevelAssignmentValues: [
        {
          parameterValue: {
            content: {
              start: 0,
              end: 12,
              startGranularity: 'DAYS',
              kind: 'DAY_RANGE',
              endGranularity: 'DAYS',
            },
          },
          riskValue: {
            type: 'RISK_LEVEL',
            value: 'MEDIUM',
          },
        },
      ] as RiskParameterLevelKeyValue[],
    }

    const v8RiskFactor: RiskFactor = {
      id: 'TEST_FACTOR',
      ...TRANSACTION_CONSUMER_USER_AGE_PLATFORM_RISK_FACTOR,
      riskLevelLogic: (
        getRiskFactorLogicByKeyAndType(
          'consumerCreatedTimestamp',
          'TRANSACTION'
        ) ?? (() => [])
      )({
        riskLevelAssignmentValues: riskFactor.riskLevelAssignmentValues,
        riskClassificationValues: DEFAULT_CLASSIFICATION_SETTINGS,
        defaultWeight: 0.5,
      }),
      defaultRiskScore: 90,
      logicAggregationVariables: [],
      logicEntityVariables: [],
      status: 'ACTIVE',
    }

    const transaction: TransactionLogicData = {
      transaction: {
        ...getTestTransaction({
          type: 'DEPOSIT',
          timestamp: undefined,
          transactionId: uuidv4(),
          destinationAmountDetails: {
            country: 'DE',
            transactionAmount: 800,
            transactionCurrency: 'INR',
          },
        }),
      },
      transactionEvents: [getTestTransactionEvent()],
      senderUser: getTestUser({
        type: 'CONSUMER',
        createdTimestamp: 1715145600,
      }),
      receiverUser: getTestUser({
        type: 'CONSUMER',
        createdTimestamp: 1715145600,
      }),
      type: 'TRANSACTION',
    }
    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()
    const riskScoringV2Service = new RiskScoringService(tenantId, {
      mongoDb,
      dynamoDb,
    })
    const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
    const riskScoringV8Service = new RiskScoringV8Service(
      tenantId,
      logicEvaluator,
      {
        mongoDb,
        dynamoDb,
      }
    )
    const v2Result = await riskScoringV2Service.simulateArsScore(
      transaction.transaction,
      DEFAULT_CLASSIFICATION_SETTINGS,
      [riskFactor]
    )
    const v8Result = await riskScoringV8Service.calculateRiskFactorScore(
      v8RiskFactor,
      {
        transaction: transaction.transaction,
        transactionEvents: transaction.transactionEvents,
        senderUser: transaction.senderUser,
        receiverUser: transaction.receiverUser,
        type: 'TRANSACTION',
      }
    )
    expect(v2Result.score).toEqual(v8Result.score)
  })
})
