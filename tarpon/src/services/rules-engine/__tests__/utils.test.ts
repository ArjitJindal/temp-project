import { filterLiveRules } from '../utils'
import { HitRulesDetails } from '@/@types/openapi-internal/HitRulesDetails'
import { ExecutedRulesResult } from '@/@types/openapi-internal/ExecutedRulesResult'

const getMockHits = (isShadow?: boolean): HitRulesDetails => ({
  ruleAction: 'SUSPEND',
  ruleId: 'ruleId',
  ruleName: 'ruleName',
  ruleDescription: 'ruleDescription',
  ruleInstanceId: 'ruleInstanceId',
  isShadow: isShadow || false,
  labels: [],
  nature: 'AML',
})

const getMockExecutedRules = (isShadow?: boolean): ExecutedRulesResult => ({
  ...getMockHits(isShadow),
  ruleHit: true,
})

describe('filterLiveRules', () => {
  it('should filter out shadow hit rules', () => {
    const executions = {
      hitRules: [getMockHits(), getMockHits(true), getMockHits()],
      executedRules: [
        getMockExecutedRules(),
        getMockExecutedRules(true),
        getMockExecutedRules(),
      ],
    }

    const filteredExecutions = filterLiveRules(executions)

    expect(filteredExecutions.hitRules.length).toBe(2)
    expect(filteredExecutions.executedRules.length).toBe(2)
  })

  it('should return empty arrays if no hit rules are passed', () => {
    const executions = {}

    const filteredExecutions = filterLiveRules(executions)

    expect(filteredExecutions.hitRules.length).toBe(0)
    expect(filteredExecutions.executedRules.length).toBe(0)
  })

  it('should return empty arrays if empty hit rules are passed', () => {
    const executions = {
      hitRules: [],
      executedRules: [],
    }

    const filteredExecutions = filterLiveRules(executions)

    expect(filteredExecutions.hitRules.length).toBe(0)
    expect(filteredExecutions.executedRules.length).toBe(0)
  })

  it('should return empty arrays if shadow hit rules are passed', () => {
    const executions = {
      hitRules: [getMockHits(true)],
      executedRules: [getMockExecutedRules(true)],
    }

    const filteredExecutions = filterLiveRules(executions)

    expect(filteredExecutions.hitRules.length).toBe(0)
    expect(filteredExecutions.executedRules.length).toBe(0)
  })
})
