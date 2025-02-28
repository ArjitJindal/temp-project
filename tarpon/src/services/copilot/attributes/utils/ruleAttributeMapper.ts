import { ruleNarratives } from '../../rule-narratives'
import { isV8RuleInstance } from '@/services/rules-engine/utils'
import { RULES_LIBRARY } from '@/services/rules-engine/transaction-rules/library'
import { RuleInstance } from '@/@types/openapi-internal/RuleInstance'

export const mapRuleAttributes = (ruleInstances: RuleInstance[]) => {
  return ruleInstances?.map((ri) => {
    const rule = RULES_LIBRARY.find((r) => r.id === ri.ruleId)

    return {
      name: ri.ruleNameAlias,
      nature: ri.nature,
      description: ri.ruleDescriptionAlias,
      ...(!isV8RuleInstance(ri)
        ? {
            checksFor: rule?.checksFor,
            types: rule?.types,
            typologies: rule?.typologies,
            sampleUseCases: rule?.sampleUseCases,
          }
        : {
            logic: ri.logic,
            logicAggregationVariables: ri.logicAggregationVariables,
          }),
      narrative:
        ruleNarratives.find((rn) => rn.id === ri.ruleId)?.narrative || '',
    }
  })
}
