import { uniq } from 'lodash'
import {
  AttributeBuilder,
  AttributeSet,
  BuilderKey,
  InputData,
} from '@/services/copilot/attributes/builder'
import { traceable } from '@/core/xray'

@traceable
export class CaseAttributeBuilder implements AttributeBuilder {
  dependencies(): BuilderKey[] {
    return ['user']
  }

  build(attributes: AttributeSet, inputData: InputData) {
    if (!inputData.ruleInstances?.length) {
      attributes.setAttribute(
        'ruleHitNames',
        uniq(inputData._case?.alerts?.map((a) => a.ruleName) || [])
      )
      attributes.setAttribute(
        'ruleHitNature',
        uniq(inputData._case?.alerts?.map((r) => r.ruleNature))
      )
    } else {
      attributes.setAttribute(
        'ruleHitNames',
        uniq(inputData.ruleInstances.map((r) => r.ruleNameAlias))
      )
      attributes.setAttribute(
        'ruleHitNature',
        uniq(inputData.ruleInstances.map((r) => r.nature))
      )
    }

    attributes.setAttribute(
      'caseComments',
      inputData._case?.comments?.map((c) => c.body) || []
    )
    attributes.setAttribute(
      'alertComments',
      inputData._case?.alerts?.flatMap((a) => a.comments?.map((c) => c.body)) ||
        []
    )
    attributes.setAttribute(
      'caseGenerationDate',
      new Date(inputData._case?.createdTimestamp || 0).toLocaleDateString() ||
        []
    )
    attributes.setAttribute('closureDate', new Date().toLocaleDateString())
  }
}
