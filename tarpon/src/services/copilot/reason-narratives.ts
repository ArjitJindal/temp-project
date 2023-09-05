import { CaseReasons } from '@/@types/openapi-internal/CaseReasons'

export const reasonNarratives: { reason: CaseReasons; narrative: string }[] = [
  {
    reason: 'Investigation completed',
    narrative:
      'Customer activity was alerted on mm/dd/yyyy  due to ( name of the rule(s)) rule (s). The activity was reviewed and transactions from _____ ( date of the first transaction alerts when the rule alerted on mm/dd/yyyy  to ___ were analysed totalling _____. The customer was requested to provide additional information/documentation to explain the activity. The customer explained that  XXXX ( from interaction with the customer) and has provided XXXXXXX( list of supporting documentation). The activity is clear and is fully supported by customer responses and documentation provided. Case closed.',
  },
  {
    reason: 'False positive',
    narrative:
      'Customer transaction was alerted on mm/dd/yyyy due to a match of the transaction field __________with a record on a sanctions list() XXXXXXXX. The record in the sanctions list, however, does not pertain to customer transactions due to geography/name/address mismatch.  Alert can be closed as false positive.',
  },
  {
    reason: 'Documents collected',
    narrative:
      'The customer provided the following documents and explanations (( fetch a list of uploaded documents))',
  },
  {
    reason: 'Transaction Rejected',
    narrative:
      'The customer activity was alerted on mm/dd/yyyy by rule__________. Upon conducting a review of the activity there is a high probability that the transaction in question is associated with fraud/money laundering/terrorist financing/sanctions evasion and it is therefore being rejected.',
  },
  {
    reason: 'Transaction Refunded',
    narrative:
      'The customer activity was alerted on mm/dd/yyyy by rule__________. Upon conducting an investigation it was identified that the transaction is associated with fraud. The transaction is being refunded back to the originator of the transaction.',
  },
  {
    reason: 'Suspicious activity reported (SAR)',
    narrative:
      'The customer activity was alerted on mm/dd/yyyy by rule__________. Upon conducting an investigation it was identified that the activity was suspicious. SAR was filed mm/dd/yyyy to _____(name of the FIU)',
  },
  {
    reason: 'Documents not collected',
    narrative:
      'The customer activity was alerted on mm/dd/yyyy by rule__________. When conducting an investigation the customer was asked to provide explanations and supporting documentation on mm/dd/yyyy. The customer did not provide the requested information to date.',
  },
  {
    reason: 'Escalated',
    narrative:
      'The customer activity was alerted on mm/dd/yyyy by rule__________. the activity was reviewed and transactions from _____ ( date of the first transaction alerts when the rule alerted on mm/dd/yyyy ) to ___ were analysed totalling _____. The activity does not match the customer profile and is therefore being escalated for further review.',
  },
  {
    reason: 'Fraud',
    narrative:
      'Customer activity was alerted on mm/dd/yyyy due to ( name of the rule(s)) rule (s). The activity was reviewed and transactions from _____ ( date of the first transaction alerts when the rule alerted on mm/dd/yyyy  to ___ were analysed totalling _____. The customer was requested to provide additional information/documentation to explain the activity. The customer explained that  XXXX ( from interaction with the customer) and has provided XXXXXXX( list of supporting documentation). The activity does not make economic sense at is likely associated with fraud due to _________ ( provide the reason).',
  },
  {
    reason: 'Anti-money laundering',
    narrative:
      'Customer activity was alerted on mm/dd/yyyy due to ( name of the rule(s)) rule (s). The activity was reviewed and transactions from _____ ( date of the first transaction alerts when the rule alerted) to ___ were analysed totalling _____. The customer was requested to provide additional information/documentation to explain the activity. The customer explained that  XXXX ( from interaction with the customer) and has provided XXXXXXX( list of supporting documentation). The activity does not make economic sense at is likely associated with money laundering due to _____ ( provide the reason).',
  },
  {
    reason: 'Terrorist financing',
    narrative:
      'Customer activity was alerted on mm/dd/yyyy due to ( name of the rule(s)) rule (s). The activity was reviewed and transactions from _____ ( date of the first transaction alerts when the rule alerted on mm/dd/yyyy  to ___ were analysed totalling _____. The customer was requested to provide additional information/documentation to explain the activity. The customer explained that  XXXX ( from interaction with the customer) and has provided XXXXXXX ( list of supporting documentation). The activity does not make economic sense at is likely associated with terrorist financing due to _____ ( provide the reason).',
  },
  {
    reason: 'User Blacklisted',
    narrative:
      'Customer activity was alerted on mm/dd/yyyy due to ( name of the rule(s)) rule (s). The activity was reviewed and transactions from _____ ( date of the first transaction alerts when the rule alerted)  to ___ were analysed totalling _____. The customer was requested to provide additional information/documentation to explain the activity. The customer explained that  XXXX ( from interaction with the customer) and has provided XXXXXXX ( list of supporting documentation). The customer was put on black list in order to prevent any future dealings with the customer.',
  },
  {
    reason: 'User Terminated',
    narrative:
      'Customer activity was alerted on mm/dd/yyyy due to ( name of the rule(s)) rule (s). The activity was reviewed and transactions from _____ ( date of the first transaction alerts when the rule alerted)  to ___ were analysed totalling _____. The customer was requested to provide additional information/documentation to explain the activity. The customer explained that  XXXX ( from interaction with the customer) and has provided XXXXXXX ( list of supporting documentation). The activity was identified as being suspicious and as a result customer account was terminated.',
  },
  {
    reason: 'Internal referral',
    narrative:
      'Customer activity was flagged internally by _______ on mm/dd/yyyy. The reason for referral was _______( e.g. transactions of the customer which occured between X and Y in the amount _____________). The customer could not explain the purpose and nature of the transactions therefore the activity was referred for review by the compliance department.',
  },
  {
    reason: 'External referral',
    narrative:
      'Customer activity referred to us by _______ on mm/dd/yyyy. The reason for referral was _______( e.g. transactions of the customer which occured between X and Y in the amount _____________). Customer activity is unusual therefore it was referred for review by the compliance department.',
  },
]
