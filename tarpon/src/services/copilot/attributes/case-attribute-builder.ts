import { uniq } from 'lodash'
import {
  AttributeBuilder,
  AttributeSet,
  BuilderKey,
  InputData,
} from '@/services/copilot/attributes/builder'

export class CaseAttributeBuilder implements AttributeBuilder {
  dependencies(): BuilderKey[] {
    return ['user']
  }

  build(attributes: AttributeSet, inputData: InputData) {
    attributes.setAttribute(
      'ruleHitNames',
      uniq(inputData._case?.alerts?.map((a) => a.ruleName) || [])
    )
    attributes.setAttribute(
      'ruleHitNature',
      uniq(inputData._case?.alerts?.map((r) => r.ruleNature))
    )
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
