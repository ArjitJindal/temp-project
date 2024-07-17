import {
  AttributeBuilder,
  AttributeSet,
  BuilderKey,
  InputData,
} from '@/services/copilot/attributes/builder'
import { traceable } from '@/core/xray'
import { ruleNarratives } from '@/services/copilot/rule-narratives'
import { isV8RuleInstance } from '@/services/rules-engine/utils'
import { RULES_LIBRARY } from '@/services/rules-engine/transaction-rules/library'

@traceable
export class CaseAttributeBuilder implements AttributeBuilder {
  dependencies(): BuilderKey[] {
    return ['user']
  }

  build(attributes: AttributeSet, inputData: InputData) {
    if (!inputData._case) {
      return
    }

    attributes.setAttribute(
      'rules',
      inputData.ruleInstances?.map((ri) => {
        const rule = RULES_LIBRARY.find((r) => r.id === r.id)

        return {
          name: ri.ruleNameAlias,
          nature: ri.nature,
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
    )

    attributes.setAttribute(
      'ruleHitNames',
      inputData.ruleInstances?.map((ri) => ri.ruleNameAlias || '') || []
    )

    attributes.setAttribute('reasons', inputData.reasons)

    attributes.setAttribute(
      'caseComments',
      inputData._case?.comments?.map((c) => c.body) || []
    )
    attributes.setAttribute(
      'alertComments',
      inputData._case?.alerts
        ?.flatMap((a) => a.comments?.map((c) => c.body))
        .filter((c): c is string => Boolean(c)) || []
    )
    attributes.setAttribute(
      'caseGenerationDate',
      new Date(inputData._case?.createdTimestamp || 0).toLocaleDateString() ||
        undefined
    )
    attributes.setAttribute('closureDate', new Date().toLocaleDateString())
  }
}
