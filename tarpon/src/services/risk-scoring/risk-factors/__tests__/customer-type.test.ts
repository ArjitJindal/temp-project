import { RiskScoringService } from '../..'
import { RiskScoringV8Service } from '../../risk-scoring-v8-service'
import { DEFAULT_CLASSIFICATION_SETTINGS } from '../../repositories/risk-repository'
import { CONSUMER_TYPE_RISK_FACTOR } from '../customer-type'
import { PARAMETER_MIGRATION_MAP } from '..'
import { TEST_CONSUMER_USER_RISK_PARAMETER } from '@/test-utils/pulse-test-utils'
import { getTestUser } from '@/test-utils/user-test-utils'
import { getTestTenantId } from '@/test-utils/tenant-test-utils'
import { getMongoDbClient } from '@/utils/mongodb-utils'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { LogicEvaluator } from '@/services/logic-evaluator/engine'
import { RiskFactor } from '@/@types/openapi-internal/RiskFactor'
import { dynamoDbSetupHook } from '@/test-utils/dynamodb-test-utils'

dynamoDbSetupHook()
describe('Customer Type Risk Factor', () => {
  const tenantId = getTestTenantId()
  test('V8 result should be equivalent to V2 result', async () => {
    const riskFactor = TEST_CONSUMER_USER_RISK_PARAMETER
    const v8RiskFactor: RiskFactor = {
      id: 'TEST_FACTOR',
      ...CONSUMER_TYPE_RISK_FACTOR,
      riskLevelLogic: PARAMETER_MIGRATION_MAP['type']({
        riskLevelAssignmentValues: riskFactor.riskLevelAssignmentValues,
        riskClassificationValues: DEFAULT_CLASSIFICATION_SETTINGS,
        defaultWeight: 0.5,
      }),
      logicAggregationVariables: [],
      logicEntityVariables: [],
      status: 'ACTIVE',
    }
    const user = { ...getTestUser(), type: 'CONSUMER' }
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
    const v2Result = await riskScoringV2Service.calculateKrsScore(
      user,
      DEFAULT_CLASSIFICATION_SETTINGS,
      [riskFactor]
    )
    const v8Result = await riskScoringV8Service.calculateRiskFactorScore(
      v8RiskFactor,
      {
        user,
        type: 'USER',
      }
    )
    expect(v2Result.score).toEqual(v8Result.score)
  })
})
