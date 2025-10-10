import { RiskScoringV8Service } from '../../../risk-scoring-v8-service'
import { getRiskFactorLogicByKeyAndType } from '../../index'
import { TRANSACTION_TRANSACTION_TYPE_RISK_FACTOR } from '../transaction-type'
import { DEFAULT_CLASSIFICATION_SETTINGS } from '@/constants/risk/classification'
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
import { TransactionWithRiskDetails } from '@/services/rules-engine/repositories/transaction-repository-interface'
import { RiskFactorParameter } from '@/@types/openapi-internal/RiskFactorParameter'
import { RiskParameterLevelKeyValue } from '@/@types/openapi-internal/RiskParameterLevelKeyValue'
dynamoDbSetupHook()
describe('Origin Payment Method TRANSACTION Risk Factor', () => {
  const tenantId = getTestTenantId()
  test('Basic case', async () => {
    const riskFactor = {
      ...TEST_TRANSACTION_RISK_PARAMETERS[0],
      parameter: 'originMccCode' as RiskFactorParameter,
      isDerived: true,
      riskLevelAssignmentValues: [
        {
          parameterValue: {
            content: {
              kind: 'LITERAL',
              content: '1234',
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
      ...TRANSACTION_TRANSACTION_TYPE_RISK_FACTOR,
      riskLevelLogic: (
        getRiskFactorLogicByKeyAndType('originMccCode', 'TRANSACTION') ??
        (() => [])
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
      transaction: getTestTransaction({
        type: 'DEPOSIT',
        originPaymentDetails: {
          method: 'CARD',
          merchantDetails: {
            MCC: '1234',
          },
        },
      }) as TransactionWithRiskDetails,
      transactionEvents: [getTestTransactionEvent()],
      senderUser: getTestUser(),
      receiverUser: getTestUser(),
      type: 'TRANSACTION',
    }

    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()
    const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
    const riskScoringV8Service = new RiskScoringV8Service(
      tenantId,
      logicEvaluator,
      {
        mongoDb,
        dynamoDb,
      }
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
    expect(50).toEqual(v8Result.score)
  })
  test('V8 result should handle null origin mcc code', async () => {
    const riskFactor = {
      ...TEST_TRANSACTION_RISK_PARAMETERS[0],
      parameter: 'originMccCode' as RiskFactorParameter,
      isDerived: true,
      riskLevelAssignmentValues: [
        {
          parameterValue: {
            content: {
              kind: 'LITERAL',
              content: '1234',
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
      ...TRANSACTION_TRANSACTION_TYPE_RISK_FACTOR,
      riskLevelLogic: (
        getRiskFactorLogicByKeyAndType('originMccCode', 'TRANSACTION') ??
        (() => [])
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
      transaction: getTestTransaction({
        type: 'DEPOSIT',
        originPaymentDetails: {
          method: 'CARD',
          merchantDetails: {
            MCC: undefined,
          },
        },
      }) as TransactionWithRiskDetails,
      transactionEvents: [getTestTransactionEvent()],
      senderUser: getTestUser(),
      receiverUser: getTestUser(),
      type: 'TRANSACTION',
    }

    const mongoDb = await getMongoDbClient()
    const dynamoDb = getDynamoDbClient()
    const logicEvaluator = new LogicEvaluator(tenantId, dynamoDb)
    const riskScoringV8Service = new RiskScoringV8Service(
      tenantId,
      logicEvaluator,
      {
        mongoDb,
        dynamoDb,
      }
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
    expect(90).toEqual(v8Result.score)
  })
})
