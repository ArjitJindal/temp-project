import { compact, uniq } from 'lodash'
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
    if (!inputData._alerts?.length) {
      return
    }

    attributes.setAttribute(
      'alertComments',
      compact(
        (inputData._alerts || [])
          .map((a) => a.comments?.map((c) => c.body))
          .flat()
      ) || []
    )

    if (!attributes.getAttribute('reasons')) {
      attributes.setAttribute('reasons', inputData.reasons)
    }

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

    const alertRuleHitNames = inputData._alerts?.map((a) => a.ruleName || '')

    alertRuleHitNames.push(
      ...(inputData.ruleInstances?.map((ri) => ri.ruleNameAlias || '') || [])
    )

    if (alertRuleHitNames.length) {
      attributes.setAttribute('ruleHitNames', uniq(alertRuleHitNames))
    }

    const alertRuleHitDescriptions = inputData._alerts?.map(
      (a) => a.ruleDescription || ''
    )

    alertRuleHitDescriptions.push(
      ...(inputData.ruleInstances?.map((ri) => ri.ruleDescriptionAlias || '') ||
        [])
    )

    if (alertRuleHitDescriptions.length) {
      attributes.setAttribute(
        'ruleHitDescriptions',
        uniq(alertRuleHitDescriptions)
      )
    }
  }
}
