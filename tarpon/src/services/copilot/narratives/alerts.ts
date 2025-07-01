import { AttributeSet } from '../attributes/attribute-set'
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
    return `Write a professional alert narrative explaining why this suspicious activity alert is being ${statusPrefix}. Justify the decision based on these reasons: ${reasons}.`
  }

  public closingNarrative(): string {
    const statusPrefix = getStatusToPrefix(this.additionalInfo.status)
    const customerType =
      this.attributes.getAttribute('userType') === 'BUSINESS'
        ? 'business'
        : 'customer'
    const reasons = this.attributes.getAttribute('reasons')?.join(', ')
    return `This ${customerType} alert is being ${statusPrefix} due to: ${reasons}. Maintain markdown formatting and use bold for key information. Do not add any unneccesary heading on top. Only fill placeholders when data is available. Please do not add information that is not available. Be very precise to the information provided.`
  }

  public reasonNarratives(): ReasonNarrative<CaseReasons>[] {
    const screening = isScreening(this.attributes)
    const comments = this.attributes.getAttribute('alertComments')
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
    const sections = {
      overview: `**OVERVIEW** \n\nName: [name] \n\nDate of Alert Generation: [alertGenerationDate] \n\nReason for Alert Generation: [ruleHitNames] \n\nInvestigation Period: [alertGenerationDate] - [alertActionDate] \n\n${statusPrefix} Date: [alertActionDate] \n\n`,
      background: `**BACKGROUND** \n\n[Provide general details about the alert in question.]`,
      investigation: `**INVESTIGATION** \n\n[Detail the investigation method and alert activities during the investigation period.]`,
      findings: `**FINDINGS AND ASSESSMENT** \n\n[Analyze the alert's ${
        screening ? 'screening details' : 'transactions'
      } and behaviors.]`,
      screeningDetails: screening
        ? `**SCREENING DETAILS** \n\n[Include sanctions, PEP, or adverse media screening results if available. Focus on screening details to justify the ${statusPrefix} decision.]\n\nSanctions Sources: [Summarize sanctions sources]`
        : '',
      conclusion: `**CONCLUSION**`,
    }

    return Object.values(sections).join('')
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
