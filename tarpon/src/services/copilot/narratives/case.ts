import { AttributeSet } from '../attributes/builder'
import { getStatusToPrefix, isScreening } from './utils'
import { reasonNarrativesCasesAlerts } from './utils/reason-narratives'
import { BaseNarrativeService, ReasonNarrative } from '.'
import { CaseStatus } from '@/@types/openapi-internal/CaseStatus'
import { CaseReasons } from '@/@types/openapi-internal/CaseReasons'

type AdditionalInfoCase = {
  status: CaseStatus
}

export class CaseNarrativeService extends BaseNarrativeService<AdditionalInfoCase> {
  public readonly type = 'CASE'
  public readonly textType = 'MARKDOWN'

  constructor(additionalInfo: AdditionalInfoCase, attributes: AttributeSet) {
    super(additionalInfo, attributes)
  }

  public introductoryNarrative(): string {
    const statusPrefix = getStatusToPrefix(this.additionalInfo.status)
    const reasons = this.attributes.getAttribute('reasons')?.join(', ')
    const string = `The following is a template for a document written by bank staff to justify why they have or have not reported a suspicious and why the case is being ${statusPrefix} for the following reasons: ${reasons}.`
    return string
  }

  public closingNarrative(): string {
    const statusPrefix = getStatusToPrefix(this.additionalInfo.status)
    const customerType =
      this.attributes.getAttribute('userType') === 'BUSINESS'
        ? 'business'
        : 'customer'
    const reasons = this.attributes.getAttribute('reasons')?.join(', ')
    return ` This is a ${customerType} and this ${this.type.toLowerCase()} is being "${statusPrefix}" for the following reasons: ${reasons}.`
  }

  public reasonNarratives(): ReasonNarrative<CaseReasons>[] {
    return reasonNarrativesCasesAlerts(this.type)
  }

  public placeholderNarrative(): string {
    const screening = isScreening(this.attributes)
    const statusPrefix = getStatusToPrefix(this.additionalInfo.status)
    const overview = `OVERVIEW \n\nName: [name] \n\nDate of Case Generation: [caseGenerationDate] \n\nReason for Case Generation: [ruleHitNames] \n\nInvestigation Period: [caseGenerationDate] - [caseActionDate] \n\n ${statusPrefix} Date: [caseActionDate] \n\n`

    const background = `BACKGROUND \n\n[This section should contain general details about the case in question.]`

    const investigation = `INVESTIGATION \n\n[This section should detail the method of the investigation and the case's activities that took place during the investigation.]`

    const findings = `FINDINGS AND ASSESSMENT \n\n[This section should contain an analysis of the case's transactions and behaviors.]`

    const screeningDetails = `SCREENING DETAILS \n\n[This section should contain information about sanctions, politically exposed persons (PEP), or adverse media screening results. If there is no information like this it can be neglected.]`

    const conclusion = `CONCLUSION`

    if (screening) {
      return (
        overview +
        background +
        investigation +
        findings +
        screeningDetails +
        conclusion
      )
    }

    return overview + background + investigation + findings + conclusion
  }
}
