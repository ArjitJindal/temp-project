import { AttributeSet } from '../attributes/attribute-set'
import { getStatusToPrefix, isScreening } from './utils'
import {
  reasonNarrativesCasesAlerts,
  reasonNarrativeScreening,
} from './utils/reason-narratives'
import { BaseNarrativeService, ReasonNarrative } from '.'
import { CaseStatus } from '@/@types/openapi-internal/CaseStatus'
import { CaseReasons } from '@/@types/openapi-internal/CaseReasons'
import { AIAttribute } from '@/@types/openapi-internal/AIAttribute'

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
    return `This is a ${customerType} and this ${this.type.toLowerCase()} is being "${statusPrefix}" for the following reasons: ${reasons}. Do not replace placeholders if you don't have information about them.`
  }

  public reasonNarratives(): ReasonNarrative<CaseReasons>[] {
    const screening = isScreening(this.attributes)
    const comments = this.attributes.getAttribute('caseComments')
    const commentsAvailable = comments ? comments.length > 0 : false
    const reasonNarratives = screening
      ? reasonNarrativeScreening(this.type, commentsAvailable)
      : reasonNarrativesCasesAlerts(this.type, commentsAvailable)
    return Object.entries(reasonNarratives).map(([reason, narrative]) => ({
      reason: reason as CaseReasons,
      narrative,
    }))
  }

  public placeholderNarrative(): string {
    const screening = isScreening(this.attributes)
    const statusPrefix = getStatusToPrefix(this.additionalInfo.status)
    const overview = `OVERVIEW \n\nName: [name] \n\nDate of Case Generation: [caseGenerationDate] \n\nReason for Case Generation: [ruleHitNames] \n\nInvestigation Period: [caseGenerationDate] - [caseActionDate] \n\n${statusPrefix} Date: [caseActionDate] \n\n`
    const background = `BACKGROUND \n\n[This section should contain general details about the case in question.]`
    const investigation = `INVESTIGATION \n\n[This section should detail the method of the investigation and the case's activities that took place during the investigation.]`

    const type = screening ? 'screening details' : 'transactions'
    const findings = `FINDINGS AND ASSESSMENT \n\n[This section should contain an analysis of the case's ${type} and behaviors.]`

    const screeningDetails = `SCREENING DETAILS \n\n[This section should contain information about sanctions, politically exposed persons (PEP), or adverse media screening results. If there is no information like this it can be neglected.] Use as much information as possible to justify the ${statusPrefix} decision\n\n Sanctions Sources: [sanctionsSources]. (Be more focused on screening details and information dense)`

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

  public disabledAttributes(): AIAttribute[] {
    const allRulesCount = this.attributes.getAttribute('rules')?.length
    const screeningRulesCount = this.attributes
      .getAttribute('rules')
      ?.filter((rule) => rule.nature === 'SCREENING').length

    if (allRulesCount === screeningRulesCount) {
      return [
        'minOriginAmount',
        'minDestinationAmount',
        'transactionIds',
        'averageDestinationAmount',
        'averageOriginAmount',
        'maxOriginAmount',
        'maxDestinationAmount',
        'destinationTransactionAmount',
        'originTransactionAmount',
        'totalOriginAmount',
        'totalDestinationAmount',
        'firstPaymentAmount',
        'transactionsCount',
        'originPaymentDetails',
        'destinationPaymentDetails',
        'destinationTransactionCountry',
        'originTransactionCountry',
        'name',
        'averageDestinationAmount',
        'originTransactionCurrency',
        'destinationTransactionCurrency',
        'transactionReference',
      ]
    }

    if (screeningRulesCount) {
      return []
    }

    return ['sanctionsHitDetails']
  }
}
