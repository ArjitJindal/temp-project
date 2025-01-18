import { compact } from 'lodash'
import {
  AttributeBuilder,
  AttributeSet,
  BuilderKey,
  InputData,
} from './builder'

import { mapRuleAttributes } from './utils/ruleAttributeMapper'

export class AlertAttributeBuilder implements AttributeBuilder {
  dependencies(): BuilderKey[] {
    return ['_alerts']
  }

  build(attributes: AttributeSet, inputData: InputData) {
    attributes.setAttribute(
      'alertComments',
      compact(
        (inputData._alerts || [])
          .map((a) => a.comments?.map((c) => c.body))
          .flat()
      ) || []
    )

    attributes.setAttribute('reasons', inputData.reasons)

    if (inputData._alerts?.[0]) {
      attributes.setAttribute(
        'alertGenerationDate',
        new Date(
          inputData._alerts?.[0]?.createdTimestamp || 0
        ).toLocaleDateString()
      )
    }

    attributes.setAttribute('alertActionDate', new Date().toLocaleDateString())

    attributes.setAttribute(
      'rules',
      mapRuleAttributes(inputData.ruleInstances || [])
    )

    attributes.setAttribute(
      'ruleHitNames',
      inputData.ruleInstances?.map((ri) => ri.ruleNameAlias || '') || []
    )
  }
}
