import { AttributeSet } from '../attributes/attribute-set'
import { getStatusToPrefix, isScreening } from './utils'
import {
  reasonNarrativesCasesAlerts,
  reasonNarrativeScreening,
} from './utils/reason-narratives'
import { BaseNarrativeService, ReasonNarrative } from '.'
import { CaseStatus } from '@/@types/openapi-internal/CaseStatus'
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
    return `Write a professional case narrative explaining why this suspicious activity case is being ${statusPrefix}. Justify the decision based on these reasons: ${reasons}.`
  }

  public closingNarrative(): string {
    const statusPrefix = getStatusToPrefix(this.additionalInfo.status)
    const customerType =
      this.attributes.getAttribute('userType') === 'BUSINESS'
        ? 'business'
        : 'customer'
    const reasons = this.attributes.getAttribute('reasons')?.join(', ')
    return `This ${customerType} case is being ${statusPrefix} due to: ${reasons}. Maintain markdown formatting and use bold for key information. Do not add any unneccesary heading on top. Only fill placeholders when data is available. Do not add information that is not available. Be very precise to the information provided.`
  }

  public reasonNarratives(): ReasonNarrative<string>[] {
    const screening = isScreening(this.attributes)
    const comments = this.attributes.getAttribute('caseComments')
    const commentsAvailable = comments ? comments.length > 0 : false
    const reasonNarratives = screening
      ? reasonNarrativeScreening(this.type, commentsAvailable)
      : reasonNarrativesCasesAlerts(this.type, commentsAvailable)
    return Object.entries(reasonNarratives).map(([reason, narrative]) => ({
      reason: reason as string,
      narrative,
    }))
  }

  public placeholderNarrative(): string {
    const screening = isScreening(this.attributes)
    const statusPrefix = getStatusToPrefix(this.additionalInfo.status)

    const sections = {
      overview: `**OVERVIEW** \n\nName: [name] \n\nDate of Case Generation: [caseGenerationDate] \n\nReason for Case Generation: [ruleHitNames] \n\nInvestigation Period: [caseGenerationDate] - [caseActionDate] \n\n${statusPrefix} Date: [caseActionDate] \n\n`,
      background: `**BACKGROUND** \n\n[Provide general details about the case in question.]\n\n`,
      investigation: `**INVESTIGATION** \n\n[Detail the investigation method and case activities during the investigation period.]\n\n`,
      findings: `**FINDINGS AND ASSESSMENT** \n\n[Analyze ${
        screening ? 'screening details' : 'transactions'
      } and behaviors]\n\n`,
      screeningDetails: screening
        ? `**SCREENING DETAILS** \n\n[Include sanctions, PEP, or adverse media screening results if available. Focus on screening details to justify the ${statusPrefix} decision.]\n\nSanctions Sources: [Summarize sanctions sources]`
        : '',
      conclusion: `**CONCLUSION** \n\n`,
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
