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
    return `Write a professional case narrative explaining why this suspicious activity case is being ${statusPrefix}. The narrative should justify the decision based on the following reasons: ${reasons}.`
  }

  public closingNarrative(): string {
    const statusPrefix = getStatusToPrefix(this.additionalInfo.status)
    const customerType =
      this.attributes.getAttribute('userType') === 'BUSINESS'
        ? 'business'
        : 'customer'
    const reasons = this.attributes.getAttribute('reasons')?.join(', ')
    return `This ${customerType} case is being ${statusPrefix} due to: ${reasons}. Maintain markdown formatting (Do not add any unneccesary heading on top) which is given to you and use bold for key information. Only fill in placeholders when data is available.`
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

    const sections = {
      overview: `**OVERVIEW** \n\nName: [name] \n\nDate of Case Generation: [caseGenerationDate] \n\nReason for Case Generation: [ruleHitNames] \n\nInvestigation Period: [caseGenerationDate] - [caseActionDate] \n\n${statusPrefix} Date: [caseActionDate] \n\n`,
      background: `**BACKGROUND** \n\n[Provide relevant details about the case]\n\n`,
      investigation: `**INVESTIGATION** \n\n[Describe investigation methodology and key findings]\n\n`,
      findings: `**FINDINGS AND ASSESSMENT** \n\n[Analyze ${
        screening ? 'screening details' : 'transactions'
      } and behaviors]\n\n`,
      screeningDetails: screening
        ? `**SCREENING DETAILS** \n\n[Include sanctions, PEP, or adverse media findings]\n\nSanctions Sources: [sanctionsSources]\n\n`
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
