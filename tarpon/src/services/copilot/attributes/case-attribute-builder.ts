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
      inputData._case?.alerts?.map((a) => a.ruleName) || []
    )
    attributes.setAttribute(
      'ruleHitNature',
      inputData._case?.alerts?.pop()?.ruleNature
    )
    attributes.setAttribute(
      'comments',
      inputData._case?.comments?.map((c) => c.body) || []
    )
  }
}
