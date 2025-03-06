import { AttributeSet } from '../attributes/attribute-set'
import { BaseNarrativeService, ReasonNarrative } from '.'
import { RuleAction } from '@/@types/openapi-internal/RuleAction'
import { CaseReasons } from '@/@types/openapi-internal/CaseReasons'
import { AIAttribute } from '@/@types/openapi-internal/AIAttribute'

type AdditionalInfoTransaction = {
  action: RuleAction
}

const ruleActionToAlias: Record<RuleAction, string> = {
  ALLOW: 'Allowing',
  SUSPEND: 'Suspending',
  BLOCK: 'Blocking',
  FLAG: 'Flagging',
}

const reasonNarrative = (action: RuleAction): Record<CaseReasons, string> => {
  return {
    'Investigation completed': `Transaction between [originUserName] and [originUserName] with amount [originTransactionCurrency] [originTransactionAmount] travelling from [originTransactionCountry] to [destinationTransactionCountry] was reviewed. After obtaining customer explanation that [Customer explanation] with [Supporting documentation], the transaction has been cleared and is now being ${ruleActionToAlias[action]}.`,
    'False positive': `Transaction flagged by [ruleHitNames] rule(s) has been reviewed. Analysis of payment from [originUserName] to [destinationUserName] indicates with the [Payment details] that this is a false positive. The transaction is now being ${ruleActionToAlias[action]}.`,
    'Documents collected': `Transaction between [originUserName] and [originUserName] for transaction related to ([transactionReference]) has been reviewed with provided documentation: [Supporting documentation]. Transaction is now being ${ruleActionToAlias[action]}.`,
    'Transaction Rejected': `Transaction of [originTransactionAmount] [originTransactionCurrency] ([originTransactionCountry] to [destinationTransactionCountry]) has been rejected. Associated business activities [industry] indicate high risk. Transaction is being ${ruleActionToAlias[action]}.`,
    'Transaction Refunded': `Transaction [transactionIds] of [originTransactionAmount] [originTransactionCurrency] is being refunded to originator [originUserName] using payment details: [originPaymentDetails].`,
    'Suspicious activity reported (SAR)': `Transaction of [originTransactionAmount] [originTransactionCurrency] between [originUserName] and [destinationUserName] indicates suspicious activity. Alert comments [alertComments] suggest SAR filing.`,
    'Documents not collected': `Transaction of [originTransactionAmount] [originTransactionCurrency] remains suspended. Required documentation from [originUserName] has not been provided. Transaction status: ${ruleActionToAlias[action]}.`,
    Escalated: `Transaction of [originTransactionAmount] [originTransactionCurrency] between [originUserName] and [originUserName] requires escalated review. Transaction patterns and user profile ([userType], [industry]) warrant additional scrutiny. Status: ${ruleActionToAlias[action]}.`,
    Fraud: `Transaction of [originTransactionAmount] [originTransactionCurrency] suspended for suspected fraud. Analysis of payment details ([originPaymentDetails]) and user activity indicates fraudulent pattern. Transaction is being ${ruleActionToAlias[action]}.`,
    'Anti-money laundering': `Transaction of [originTransactionAmount] [originTransactionCurrency] from [originUserName] ([originTransactionCountry]) to [originUserName] ([destinationTransactionCountry]) suspended for AML review. Risk factors include: high transaction amount [originTransactionCurrency] [originTransactionAmount], high-risk jurisdictions, and unusual cross-border transactions from [originTransactionCountry] to [destinationTransactionCountry].`,
    'Terrorist financing': `Transaction of [originTransactionAmount] [originTransactionCurrency] from [originUserName] ([originTransactionCountry]) to [originUserName] ([destinationTransactionCountry]) suspended for terrorist financing review. Risk factors include: high transaction amount [originTransactionCurrency] [originTransactionAmount], high-risk jurisdictions, and unusual cross-border transactions from [originTransactionCountry] to [destinationTransactionCountry].`,
    'User Blacklisted': `User [originUserName] has been blacklisted. All pending transactions including [transactionIds] with amount [originTransactionCurrency] [originTransactionAmount] are suspended. Future transactions will be prevented.`,
    'User Terminated': `User [originUserName] has been terminated. Transfering amount of [originTransactionCurrency] [originTransactionAmount] to [destinationUserName] from [originPaymentDetails] to [destinationPaymentDetails] is being terminated and the transaction is being ${ruleActionToAlias[action]}.`,
    'Internal referral': `Transaction of [originTransactionAmount] [originTransactionCurrency] referred for internal review. The transaction was referenced as [transactionReference] and the alert comments [alertComments] suggest internal referral and the transaction is being ${ruleActionToAlias[action]}.`,
    'External referral': `Transaction activity of [originUserName] to [destinationUserName] from [originTransactionCountry] to [destinationTransactionCountry] referred to external authorities. The transaction was referenced as [transactionReference] and the alert comments [alertComments] suggest external referral and the transaction is being ${ruleActionToAlias[action]}.`,
    'Confirmed fraud': `Transaction of [originTransactionAmount] [originTransactionCurrency] identified at [timeOfTransaction] has been confirmed as fraudulent following investigation of [ruleHitNames] rule(s). Transaction is being ${ruleActionToAlias[action]}.`,
    'Confirmed genuine': `Transaction of [originTransactionAmount] [originTransactionCurrency] has been confirmed as legitimate. Review of business activities ([industry]) and supporting documentation validates the transaction. Status: ${ruleActionToAlias[action]}.`,
    'Suspected fraud': `Transaction of [originTransactionAmount] [originTransactionCurrency] from [originUserName] shows suspicious patterns. Analysis of [transactionsCount] related transactions suggests potential fraud. Additional monitoring implemented.`,
    'True positive': `Alert triggered by [ruleHitNames] rule(s) confirmed as true positive. Analysis of Transaction ID: [transactionIds] with amount [originTransactionCurrency] [originTransactionAmount] being transferred from [originUserName] to [destinationUserName] indicates a true positive.`,
    Other: `Transaction of [originTransactionCurrency] [originTransactionAmount] between [originUserName] and [originUserName] requires review due to unusual circumstances. Status: ${ruleActionToAlias[action]}.`,
  }
}

export class TransactionNarrativeService extends BaseNarrativeService<AdditionalInfoTransaction> {
  public readonly type = 'TRANSACTION'
  public readonly textType = 'MARKDOWN'

  constructor(
    additionalInfo: AdditionalInfoTransaction,
    attributes: AttributeSet
  ) {
    super(additionalInfo, attributes)
  }

  public introductoryNarrative(): string {
    return `The following transaction was detected suspicious and was "Suspended". An analyst has reviewed the transaction and now ${
      ruleActionToAlias[this.additionalInfo.action]
    } it.`
  }

  public placeholderNarrative(): string {
    const overview = `OVERVIEW \n\n Transaction ID: [transactionIds] \n\n Time of Transaction: [timeOfTransaction] \n\n Origin transaction amount: [originTransactionCurrency][originTransactionAmount] \n\n Destination transaction amount: [destinationTransactionCurrency][destinationTransactionAmount] \n\n Origin transaction country: [originTransactionCountry] \n\n Destination transaction country: [destinationTransactionCountry] \n\n`

    const background = `BACKGROUND \n\n[This section should contain general details about the transaction in question.]`

    const investigation = `INVESTIGATION \n\n[This section should detail the method of the investigation and the transaction's activities that took place during the investigation.]`

    const findings = `FINDINGS AND ASSESSMENT \n\n[This section should contain an analysis of the transaction's activities.]`

    const conclusion = `CONCLUSION \n\n[This section should contain a summary of the transaction's activities and the analyst's assessment of the transaction.]`

    return overview + background + investigation + findings + conclusion
  }

  public reasonNarratives(): ReasonNarrative<CaseReasons>[] {
    return Object.entries(reasonNarrative(this.additionalInfo.action)).map(
      ([reason, narrative]) => ({
        reason: reason as CaseReasons,
        narrative,
      })
    )
  }

  public closingNarrative(): string {
    const reasons = this.attributes.getAttribute('reasons')?.join(', ')
    return `The transaction has been ${
      ruleActionToAlias[this.additionalInfo.action]
    }. Based on the following reasons: ${reasons}. You need be like a bank analyst and write a narrative that is easy to understand and contains all the possible information about why the transaction was ${
      ruleActionToAlias[this.additionalInfo.action]
    }.`
  }

  public disabledAttributes(): AIAttribute[] {
    return ['sanctionsHitDetails']
  }
}
