import { v4 as uuidv4 } from 'uuid'
import { RiskScoringV8Service } from '../../../risk-scoring-v8-service'
import { DEFAULT_CLASSIFICATION_SETTINGS } from '../../../repositories/risk-repository'
import { getRiskFactorLogicByKeyAndType } from '../../index'
import { TRANSACTION_DESTINATION_TRANSACTION_AMOUNT_RISK_FACTOR } from '../destination-transaction-amount'
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
dynamoDbSetupHook()
describe('Destination Transaction Amount TRANSACTION Risk Factor', () => {
  const tenantId = getTestTenantId()
  test('Basic case', async () => {
    const riskFactor = {
      ...TEST_TRANSACTION_RISK_PARAMETERS[9],
      isDerived: true,
    }

    const v8RiskFactor: RiskFactor = {
      id: 'TEST_FACTOR',
      ...TRANSACTION_DESTINATION_TRANSACTION_AMOUNT_RISK_FACTOR,
      riskLevelLogic: (
        getRiskFactorLogicByKeyAndType(
          'destinationAmountDetails.transactionAmount',
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
      transaction: getTestTransaction({
        type: 'DEPOSIT',
        timestamp: 1715145600,
        transactionId: uuidv4(),
        destinationAmountDetails: {
          transactionAmount: 120000,
          transactionCurrency: 'INR',
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
  test('V8 result should handle null destination transaction amount', async () => {
    const riskFactor = {
      ...TEST_TRANSACTION_RISK_PARAMETERS[9],
      isDerived: true,
    }

    const v8RiskFactor: RiskFactor = {
      id: 'TEST_FACTOR',
      ...TRANSACTION_DESTINATION_TRANSACTION_AMOUNT_RISK_FACTOR,
      riskLevelLogic: (
        getRiskFactorLogicByKeyAndType(
          'destinationAmountDetails.transactionAmount',
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
      transaction: getTestTransaction({
        type: 'DEPOSIT',
        timestamp: 1715145600,
        transactionId: uuidv4(),
        destinationAmountDetails: undefined,
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
