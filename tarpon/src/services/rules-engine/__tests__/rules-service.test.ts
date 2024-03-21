import { RuleService } from '../rule-service'
import { RiskLevel } from '@/@types/openapi-internal/RiskLevel'
import { RuleAggregationVariable } from '@/@types/openapi-internal/RuleAggregationVariable'
import { RISK_LEVELS } from '@/@types/openapi-public-custom/RiskLevel'

type RuleLogicTest = {
  ruleLogic: unknown
  riskLevelRuleLogic: Record<RiskLevel, unknown>
  logicAggregationVariables?: Array<RuleAggregationVariable>
  expected: boolean
  name: string
}
const ruleLogic = {
  and: [
    { '==': [{ var: 'TRANSACTION:type' }, 'DEPOSIT'] },
    { '==': [{ var: 'agg:fb96ab49-e552-4ea0-a539-55070238b316' }, 1] },
  ],
}
const logicAggregationVariables: Array<RuleAggregationVariable> = [
  {
    key: 'agg:fb96ab49-e552-4ea0-a539-55070238b316',
    type: 'USER_TRANSACTIONS',
    userDirection: 'SENDER_OR_RECEIVER',
    transactionDirection: 'SENDING_RECEIVING',
    aggregationFieldKey: 'TRANSACTION:type',
    aggregationFunc: 'UNIQUE_COUNT',
    timeWindow: {
      start: {
        units: 1,
        granularity: 'day',
      },
      end: {
        units: 0,
        granularity: 'now',
      },
    },
  },
]
describe.each<RuleLogicTest>([
  {
    name: 'should pass',
    riskLevelRuleLogic: RISK_LEVELS.reduce((acc, riskLevel) => {
      acc[riskLevel] = ruleLogic
      return acc
    }, {} as Record<RiskLevel, unknown>),
    ruleLogic,
    expected: true,
    logicAggregationVariables,
  },
  {
    name: 'should fail',
    riskLevelRuleLogic: RISK_LEVELS.reduce((acc, riskLevel) => {
      acc[riskLevel] = {
        [riskLevel]: ruleLogic,
      }
      return acc
    }, {} as Record<RiskLevel, unknown>),
    ruleLogic,
    expected: false,
    logicAggregationVariables,
  },
])(
  'RuleService',
  ({
    ruleLogic,
    riskLevelRuleLogic,
    logicAggregationVariables,
    expected,
    name,
  }) => {
    it(name, async () => {
      const result = RuleService.validateRuleLogic(
        ruleLogic,
        riskLevelRuleLogic,
        logicAggregationVariables
      )

      if (expected) {
        expect(await result).toBeUndefined()
      } else {
        await expect(result).rejects.toThrow()
      }
    })
  }
)
