import { CaseReasons } from '@/@types/openapi-internal/CaseReasons'

export const reasonNarratives = (
  type: 'CASE' | 'ALERT'
): { reason: CaseReasons; narrative: string }[] => {
  const entityGenerationDate =
    type === 'CASE' ? 'caseGenerationDate' : 'alertGenerationDate'
  const entityActionDate =
    type === 'CASE' ? 'caseActionDate' : 'alertActionDate'
  const entity = type === 'CASE' ? 'Case' : 'Alert'

  return [
    {
      reason: 'Investigation completed',
      narrative: `Customer activity was alerted on [${entityGenerationDate}] due to [ruleHitNames] rule(s). The activity was reviewed and transactions from [${entityGenerationDate}] to [${entityActionDate}] were analysed totalling [totalOriginAmount]. The customer was requested to provide additional information/documentation to explain the activity. The customer explained that [Customer explanation] and has provided [Supporting documentation]. The activity is clear and is fully supported by customer responses and documentation provided. ${entity} closed.`,
    },
    {
      reason: 'False positive',
      narrative: `Customer activity was alerted on [${entityGenerationDate}] due to [ruleHitNames] rule(s). [Why is it false positive]. ${entity} can be closed as false positive.`,
    },
    {
      reason: 'Documents collected',
      narrative:
        'The customer provided the following documents and explanations: [List of uploaded documents]',
    },
    {
      reason: 'Transaction Rejected',
      narrative: `Customer activity was alerted on [${entityGenerationDate}] due to [ruleHitNames] rule(s). Upon conducting a review of the activity there is a high probability that the transaction in question is associated with [fraud/money laundering/terrorist financing/sanctions evasion] and it is therefore being rejected.`,
    },
    {
      reason: 'Transaction Refunded',
      narrative: `Customer activity was alerted on [${entityGenerationDate}] due to [ruleHitNames] rule(s). The transaction is being refunded back to the originator of the transaction.`,
    },
    {
      reason: 'Suspicious activity reported (SAR)',
      narrative: `Customer activity was alerted on [${entityGenerationDate}] due to [ruleHitNames] rule(s).  Upon conducting an investigation it was identified that the activity was suspicious. SAR was filed [${entityActionDate}] to [Name of the FIU]`,
    },
    {
      reason: 'Documents not collected',
      narrative: `Customer activity was alerted on [${entityGenerationDate}] due to [ruleHitNames] rule(s).  When conducting an investigation the customer was asked to provide explanations and supporting documentation on [Date customer asked to provider documentation]. The customer did not provide the requested information to date.`,
    },
    {
      reason: 'Escalated',
      narrative: `Customer activity was alerted on [${entityGenerationDate}] due to [ruleHitNames] rule(s).  the activity was reviewed and transactions from [${entityGenerationDate}] to [${entityActionDate}] were analysed totalling [totalOriginAmount]. The activity does not match the customer profile and is therefore being escalated for further review.`,
    },
    {
      reason: 'Fraud',
      narrative: `Customer activity was alerted on [${entityGenerationDate}] due to [ruleHitNames] rule(s).  The activity was reviewed and transactions from [${entityGenerationDate}] to [${entityActionDate}] were analysed totalling [totalOriginAmount]. The customer was requested to provide additional information/documentation to explain the activity. The customer explained that [Interaction with the customer] and has provided [List of supporting documentation]. The activity does not make economic sense at is likely associated with fraud due to [Provide reason it may be fraud].`,
    },
    {
      reason: 'Anti-money laundering',
      narrative: `Customer activity was alerted on [${entityGenerationDate}] due to [ruleHitNames] rule(s).  The activity was reviewed and transactions from [${entityGenerationDate}] to [${entityActionDate}] were analysed totalling [totalOriginAmount]. The customer was requested to provide additional information/documentation to explain the activity. The customer explained that [Interaction with the customer] and has provided [List of supporting documentation]. The activity does not make economic sense at is likely associated with money laundering due to [Provide reason it may be money laundering].`,
    },
    {
      reason: 'Terrorist financing',
      narrative: `Customer activity was alerted on [${entityGenerationDate}] due to [ruleHitNames] rule(s).  The activity was reviewed and transactions from [${entityGenerationDate}] to [${entityActionDate}] were analysed totalling [totalOriginAmount]. The customer was requested to provide additional information/documentation to explain the activity. The customer explained that [Interaction with the customer] and has provided [List of supporting documentation]. The activity does not make economic sense at is likely associated with terrorist financing due to [Provide reason it may be terrorist financing].`,
    },
    {
      reason: 'User Blacklisted',
      narrative: `Customer activity was alerted on [${entityGenerationDate}] due to [ruleHitNames] rule(s).  The activity was reviewed and transactions from [${entityGenerationDate}] to [${entityActionDate}] were analysed totalling [totalOriginAmount]. The customer was requested to provide additional information/documentation to explain the activity. The customer explained that  XXXX ( from interaction with the customer) and has provided XXXXXXX ( list of supporting documentation). The customer was put on black list in order to prevent any future dealings with the customer.`,
    },
    {
      reason: 'User Terminated',
      narrative: `Customer activity was alerted on [${entityGenerationDate}] due to [ruleHitNames] rule(s). The activity was reviewed and transactions from [${entityGenerationDate}] to [${entityActionDate}] were analysed totalling [totalOriginAmount]. The customer was requested to provide additional information/documentation to explain the activity. The customer explained that  XXXX ( from interaction with the customer) and has provided XXXXXXX ( list of supporting documentation). The activity was identified as being suspicious and as a result customer account was terminated.`,
    },
    {
      reason: 'Internal referral',
      narrative: `Customer activity was alerted on [${entityGenerationDate}] due to [ruleHitNames] rule(s). The reason for referral was [Why is the case internally referred]. The customer could not explain the purpose and nature of the transactions therefore the activity was referred for review by the compliance department.`,
    },
    {
      reason: 'External referral',
      narrative: `Customer activity was alerted on [${entityGenerationDate}] due to [ruleHitNames] rule(s).  The reason for referral was [Why is the case externally referred]. Customer activity is unusual therefore it was referred for review by the compliance department.`,
    },
    {
      reason: 'Confirmed fraud',
      narrative: `Customer activity was alerted on [${entityGenerationDate}] due to [ruleHitNames] rule(s). Transactions from [${entityGenerationDate}] to [${entityActionDate}] were analyzed totaling [totalOriginAmount]. Upon review, the activity was confirmed to be fraudulent due to [details of fraudulent activity]. The customer was informed, and appropriate actions were taken, including account closure and reporting to the relevant authorities.`,
    },
    {
      reason: 'Confirmed genuine',
      narrative: `Customer activity was alerted on [${entityGenerationDate}] due to [ruleHitNames] rule(s). After thorough analysis of transactions from [${entityGenerationDate}] to [${entityActionDate}], and reviewing the customer’s explanation and supporting documentation, the activity was confirmed to be legitimate. No further action was required, and the case was closed.`,
    },
    {
      reason: 'Suspected fraud',
      narrative: `Customer activity was alerted on [${entityGenerationDate}] due to [ruleHitNames] rule(s). After reviewing transactions and supporting documentation from [${entityGenerationDate}] to [${entityActionDate}], the activity raised concerns of potential fraudulent behavior. However, more evidence is required to confirm fraud. As a precaution, the case has been flagged for further investigation and monitoring.`,
    },
    {
      reason: 'True positive',
      narrative: `Customer activity was alerted on [${entityGenerationDate}] due to [ruleHitNames] rule(s). Transactions between [${entityGenerationDate}] and [${entityActionDate}] were reviewed, and it was determined that the alert was a true positive. The customer’s activity was found to match patterns associated with [specific risk type]. As a result, the case was escalated for appropriate action by the compliance department.`,
    },
  ]
}
