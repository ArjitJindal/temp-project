import {
  AttributeBuilder,
  AttributeSet,
  BuilderKey,
  InputData,
} from './builder'

import { mapRuleAttributes } from './utils/ruleAttributeMapper'

export class AlertAttributeBuilder implements AttributeBuilder {
  dependencies(): BuilderKey[] {
    return ['_alert']
  }

  build(attributes: AttributeSet, inputData: InputData) {
    attributes.setAttribute(
      'alertComments',
      inputData._alert?.comments?.map((c) => c.body) || []
    )

    attributes.setAttribute('reasons', inputData.reasons)

    attributes.setAttribute(
      'alertGenerationDate',
      new Date(inputData._alert?.createdTimestamp || 0).toLocaleDateString()
    )

    attributes.setAttribute('alertActionDate', new Date().toLocaleDateString())

    attributes.setAttribute(
      'rules',
      mapRuleAttributes(inputData.ruleInstances || [])
    )
  }
}
