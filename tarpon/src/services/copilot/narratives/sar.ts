import { AttributeSet } from '../attributes/builder'
import { BaseNarrativeService, ReasonNarrative } from '.'

export class SarNarrativeService extends BaseNarrativeService<object> {
  public readonly type = 'REPORT'
  public readonly textType = 'PLAIN'

  constructor(additionalInfo: object, attributes: AttributeSet) {
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
    return ''
  }

  public introductoryNarrative(): string {
    const customerType =
      this.attributes.getAttribute('userType') === 'BUSINESS'
        ? 'business'
        : 'customer'

    return `The following is a template for suspicious activity report written by bank staff to justify why they are reporting a ${customerType} to the financial authorities.`
  }
}
