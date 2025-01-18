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
    if (!inputData._case) {
      return
    }

    attributes.setAttribute('reasons', inputData.reasons)

    attributes.setAttribute(
      'caseComments',
      inputData._case?.comments?.map((c) => c.body) || []
    )

    attributes.setAttribute(
      'caseGenerationDate',
      new Date(inputData._case?.createdTimestamp || 0).toLocaleDateString() ||
        undefined
    )

    attributes.setAttribute('caseActionDate', new Date().toLocaleDateString())
  }
}
