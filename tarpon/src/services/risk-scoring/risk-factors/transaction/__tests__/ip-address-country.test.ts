import { v4 as uuidv4 } from 'uuid'
import { RiskScoringV8Service } from '../../../risk-scoring-v8-service'
import { getRiskFactorLogicByKeyAndType } from '../../index'
import { TRANSACTION_ORIGIN_COUNTRY_RISK_FACTOR } from '../origin-country'
import { DEFAULT_CLASSIFICATION_SETTINGS } from '@/constants/risk/classification'
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
import { TEST_TRANSACTION_RISK_PARAMETERS } from '@/test-utils/pulse-test-utils'
dynamoDbSetupHook()
describe('IP Address Country TRANSACTION Risk Factor', () => {
  const tenantId = getTestTenantId()
  test('Basic case', async () => {
    const riskFactor = TEST_TRANSACTION_RISK_PARAMETERS[6]

    const v8RiskFactor: RiskFactor = {
      id: 'TEST_FACTOR',
      ...TRANSACTION_ORIGIN_COUNTRY_RISK_FACTOR,
      riskLevelLogic: (
        getRiskFactorLogicByKeyAndType('ipAddressCountry', 'TRANSACTION') ??
        (() => [])
      )({
        riskLevelAssignmentValues: riskFactor.riskLevelAssignmentValues,
        riskClassificationValues: DEFAULT_CLASSIFICATION_SETTINGS,
        defaultWeight: 0.5,
      }),
      defaultRiskScore: 50,
      logicAggregationVariables: [],
      logicEntityVariables: [],
      status: 'ACTIVE',
    }

    const transaction: TransactionLogicData = {
      transaction: getTestTransaction({
        type: 'DEPOSIT',
        timestamp: 1715145600,
        transactionId: uuidv4(),
        originAmountDetails: {
          country: 'DE',
          transactionAmount: 800,
          transactionCurrency: 'EUR',
        },
        originDeviceData: {
          ipAddress: '1.38.0.0',
        },
        destinationDeviceData: {
          ipAddress: '1.38.0.255',
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
  test('V8 result should handle empty transaction country for ip address country', async () => {
    const riskFactor = TEST_TRANSACTION_RISK_PARAMETERS[6]

    const v8RiskFactor: RiskFactor = {
      id: 'TEST_FACTOR',
      ...TRANSACTION_ORIGIN_COUNTRY_RISK_FACTOR,
      riskLevelLogic: (
        getRiskFactorLogicByKeyAndType('ipAddressCountry', 'TRANSACTION') ??
        (() => [])
      )({
        riskLevelAssignmentValues: riskFactor.riskLevelAssignmentValues,
        riskClassificationValues: DEFAULT_CLASSIFICATION_SETTINGS,
        defaultWeight: 0.5,
      }),
      defaultRiskScore: 50,
      logicAggregationVariables: [],
      logicEntityVariables: [],
      status: 'ACTIVE',
    }

    const transaction: TransactionLogicData = {
      transaction: getTestTransaction({
        type: 'DEPOSIT',
        timestamp: 1715145600,
        transactionId: uuidv4(),
        originAmountDetails: {
          country: 'DE',
          transactionAmount: 800,
          transactionCurrency: 'EUR',
        },
        originDeviceData: {
          ipAddress: '',
        },
        destinationDeviceData: {
          ipAddress: '',
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
  test('V8 result should handle null origin and empty destination transaction device data ip address country', async () => {
    const riskFactor = TEST_TRANSACTION_RISK_PARAMETERS[6]

    const v8RiskFactor: RiskFactor = {
      id: 'TEST_FACTOR',
      ...TRANSACTION_ORIGIN_COUNTRY_RISK_FACTOR,
      riskLevelLogic: (
        getRiskFactorLogicByKeyAndType('ipAddressCountry', 'TRANSACTION') ??
        (() => [])
      )({
        riskLevelAssignmentValues: riskFactor.riskLevelAssignmentValues,
        riskClassificationValues: DEFAULT_CLASSIFICATION_SETTINGS,
        defaultWeight: 0.5,
      }),
      defaultRiskScore: 50,
      logicAggregationVariables: [],
      logicEntityVariables: [],
      status: 'ACTIVE',
    }

    const transaction: TransactionLogicData = {
      transaction: getTestTransaction({
        type: 'DEPOSIT',
        timestamp: 1715145600,
        transactionId: uuidv4(),
        originAmountDetails: {
          country: 'DE',
          transactionAmount: 800,
          transactionCurrency: 'EUR',
        },
        originDeviceData: {
          ipAddress: undefined,
        },
        destinationDeviceData: {
          ipAddress: '',
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
  test('V8 result should handle empty origin and null destination transaction device data ip address country', async () => {
    const riskFactor = TEST_TRANSACTION_RISK_PARAMETERS[6]

    const v8RiskFactor: RiskFactor = {
      id: 'TEST_FACTOR',
      ...TRANSACTION_ORIGIN_COUNTRY_RISK_FACTOR,
      riskLevelLogic: (
        getRiskFactorLogicByKeyAndType('ipAddressCountry', 'TRANSACTION') ??
        (() => [])
      )({
        riskLevelAssignmentValues: riskFactor.riskLevelAssignmentValues,
        riskClassificationValues: DEFAULT_CLASSIFICATION_SETTINGS,
        defaultWeight: 0.5,
      }),
      defaultRiskScore: 50,
      logicAggregationVariables: [],
      logicEntityVariables: [],
      status: 'ACTIVE',
    }

    const transaction: TransactionLogicData = {
      transaction: getTestTransaction({
        type: 'DEPOSIT',
        timestamp: 1715145600,
        transactionId: uuidv4(),
        originAmountDetails: {
          country: 'DE',
          transactionAmount: 800,
          transactionCurrency: 'EUR',
        },
        originDeviceData: {
          ipAddress: '',
        },
        destinationDeviceData: {
          ipAddress: undefined,
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
  test('V8 result should handle null transaction country for ip address country', async () => {
    const riskFactor = TEST_TRANSACTION_RISK_PARAMETERS[6]

    const v8RiskFactor: RiskFactor = {
      id: 'TEST_FACTOR',
      ...TRANSACTION_ORIGIN_COUNTRY_RISK_FACTOR,
      riskLevelLogic: (
        getRiskFactorLogicByKeyAndType('ipAddressCountry', 'TRANSACTION') ??
        (() => [])
      )({
        riskLevelAssignmentValues: riskFactor.riskLevelAssignmentValues,
        riskClassificationValues: DEFAULT_CLASSIFICATION_SETTINGS,
        defaultWeight: 0.5,
      }),
      defaultRiskScore: 50,
      logicAggregationVariables: [],
      logicEntityVariables: [],
      status: 'ACTIVE',
    }

    const transaction: TransactionLogicData = {
      transaction: getTestTransaction({
        type: 'DEPOSIT',
        timestamp: 1715145600,
        transactionId: uuidv4(),
        originAmountDetails: {
          country: 'DE',
          transactionAmount: 800,
          transactionCurrency: 'EUR',
        },
        originDeviceData: {
          ipAddress: undefined,
        },
        destinationDeviceData: {
          ipAddress: undefined,
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
})
