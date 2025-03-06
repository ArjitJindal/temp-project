import { AttributeSet } from '../attributes/attribute-set'
import { BaseNarrativeService, ReasonNarrative } from '.'
import { AdditionalCopilotInfoAdditionalSarInformation } from '@/@types/openapi-internal/AdditionalCopilotInfoAdditionalSarInformation'
import { AIAttribute } from '@/@types/openapi-internal/AIAttribute'

export class SarNarrativeService extends BaseNarrativeService<AdditionalCopilotInfoAdditionalSarInformation> {
  public readonly type = 'REPORT'
  public readonly textType = 'PLAIN'

  constructor(
    additionalInfo: AdditionalCopilotInfoAdditionalSarInformation,
    attributes: AttributeSet
  ) {
    super(additionalInfo, attributes)
  }

  public closingNarrative(): string {
    const rules = this.attributes.getAttribute('rules')
    if (!rules) {
      return ''
    }

    return `Example:
    ${rules.map((r) => r.narrative).join(', ')}`
  }

  public reasonNarratives(): ReasonNarrative<string>[] {
    return []
  }

  public placeholderNarrative(): string {
    const additionalSarInformation = this.additionalInfo.title
    const additionalSarInformationDescription = this.additionalInfo.description
    return `
    The following narrative is for a field with title "${additionalSarInformation}" and description "${additionalSarInformationDescription}". Write a narrative that is relevant to the field.
    `
  }

  public introductoryNarrative(): string {
    const customerType =
      this.attributes.getAttribute('userType') === 'BUSINESS'
        ? 'business'
        : 'customer'

    return `The following is a template for suspicious activity report written by bank staff to justify why they are reporting a ${customerType} to the financial authorities. This is basically a paragraph that explains why the bank is reporting the ${customerType}.`
  }

  public disabledAttributes(): AIAttribute[] {
    return []
  }
}
