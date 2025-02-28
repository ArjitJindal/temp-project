import { AttributeSet } from '../attributes/builder'
import { getStatusToPrefix, isScreening } from './utils'
import {
  reasonNarrativesCasesAlerts,
  reasonNarrativeScreening,
} from './utils/reason-narratives'
import { BaseNarrativeService, ReasonNarrative } from '.'
import { AlertStatus } from '@/@types/openapi-internal/AlertStatus'
import { CaseReasons } from '@/@types/openapi-internal/CaseReasons'
import { AIAttribute } from '@/@types/openapi-internal/AIAttribute'

type AdditionalInfoAlert = {
  status: AlertStatus
}

export class AlertNarrativeService extends BaseNarrativeService<AdditionalInfoAlert> {
  public readonly type = 'ALERT'
  public readonly textType = 'MARKDOWN'

  constructor(additionalInfo: AdditionalInfoAlert, attributes: AttributeSet) {
    super(additionalInfo, attributes)
  }

  public introductoryNarrative(): string {
    const statusPrefix = getStatusToPrefix(this.additionalInfo.status)
    const reasons = this.attributes.getAttribute('reasons')?.join(', ')
    const string = `The following is a template for a document written by bank staff to justify why they have or have not reported a suspicious and why the alert is being ${statusPrefix} for the following reasons: ${reasons}.`
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
    const screening = isScreening(this.attributes)
    const reasonNarratives = screening
      ? reasonNarrativeScreening(this.type)
      : reasonNarrativesCasesAlerts(this.type)
    return Object.entries(reasonNarratives).map(([reason, narrative]) => ({
      reason: reason as CaseReasons,
      narrative,
    }))
  }

  public placeholderNarrative(): string {
    const screening = isScreening(this.attributes)
    const statusPrefix = getStatusToPrefix(this.additionalInfo.status)
    const overview = `OVERVIEW \n\nName: [name] \n\nDate of Alert Generation: [alertGenerationDate] \n\nReason for Alert Generation: [ruleHitNames] \n\nInvestigation Period: [alertGenerationDate] - [alertActionDate] \n\n${statusPrefix} Date: [alertActionDate] \n\n`

    const background = `BACKGROUND \n\n[This section should contain general details about the alert in question.]`

    const investigation = `INVESTIGATION \n\n[This section should detail the method of the investigation and the alert's activities that took place during the investigation.]`

    const findings = `FINDINGS AND ASSESSMENT \n\n[This section should contain an analysis of the alert's transactions and behaviors.]`

    const screeningDetails = `SCREENING DETAILS \n\n[This section should contain information about sanctions, politically exposed persons (PEP), or adverse media screening results. If there is no information like this it can be neglected.] Use as much information as possible to justify the ${statusPrefix} decision. You should be more foucesed on screening details and information dense\n\n Sanctions Sources: [sanctionsSources]`

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
    if (isScreening(this.attributes)) {
      return [
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
    return ['sanctionsHitDetails']
  }
}
