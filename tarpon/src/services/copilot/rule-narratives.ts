export const ruleNarratives = [
  {
    id: 'R-1',
    narrative:
      'The customer activity was alerted by our transaction monitoring system on [caseGenerationDate] by the rule "First Payment of a customer". The customer was asked to explain and provide supporting documentation for the incoming/outgoing transactions for the amount [totalTransactionAmount] on [Date customer was contacted] for transaction IDs [transactionIds]. The customer did not provide a relevant explanation/is not responsive/or the provided explanations and documentation are not in line with the KYC information we hold on the customer. The activity does not make economic sense and, therefore we find it suspicious and believe that it can be associated with money laundering/terrorist financing.',
  },
  {
    id: 'R-2',
    narrative:
      'The customer activity was alerted by our transaction monitoring system on [caseGenerationDate] by the rule "Transaction amount too high". The customer received/sent [totalTransactionAmount] between [caseGenerationDate] to [Case closure date] with transaction IDs [transactionIds]. The counterparty of the transaction was reviewed and material adverse media was identified via public search ( then explain what exactly adverse media says ). The customer was asked to explain and provide supporting documentation for the transactions for the high amount of [totalTransactionAmount] on [Date customer was contacted]. The customer did not provide a relevant explanation/is not responsive/or the provided explanations and documentation are not in line with the KYC information we hold on the customer. The activity does not make economic sense and, therefore we find it suspicious and believe that it can be associated with money laundering/terrorist financing.',
  },
  {
    id: 'R-3',
    narrative:
      'The customer activity was alerted by our transaction monitoring system on mm/dd/yyyy by the rule "Unexpected origin or destination country". The customer received/sent XXXXXXXX on mm/dd/yyyy from/to _____(name of the counterparty) ____________account in ___( country name). The counterparty of the transaction was reviewed and material adverse media was identified via public search ( then explain what exactly adverse media says ). The customer was asked to explain and provide supporting documentation for the transactions for the high amount of ______ on dd/mm/yyyy. The customer did not provide a relevant explanation/is not responsive/or the provided explanations and documentation are not in line with the KYC information we hold on the customer. The activity does not make economic sense and, therefore we find it suspicious and believe that it can be associated with money laundering/terrorist financing.',
  },
  {
    id: 'R-4',
    narrative:
      'The customer activity was alerted by our transaction monitoring system on mm/dd/yyyy by the rule "Unexpected origin or destination currency". The customer received/sent XXXXXXXX on mm/dd/yyyy from/to _____(name of the counterparty) ____________account in ___( country name). The counterparty of the transaction was reviewed and material adverse media was identified via public search ( then explain what exactly adverse media says ). The customer was asked to explain and provide supporting documentation for the transactions for the unexpected origin or destination currency ______ on dd/mm/yyyy. The customer did not provide a relevant explanation/is not responsive/or the provided explanations and documentation are not in line with the KYC information we hold on the customer. The activity does not make economic sense and, therefore we find it suspicious and believe that it can be associated with money laundering/terrorist financing.',
  },
  {
    id: 'R-5',
    narrative:
      'The customer activity was alerted by our transaction monitoring system on mm/dd/yyyy by the rule "Dormant accounts". The customer was inactive since _____ before the alert was triggered. The customer received/sent XXXXXXXX on mm/dd/yyyy from/to _____(name of the counterparty) ____________account in ___( country name). The counterparty of the transaction was reviewed and material adverse media was identified via public search ( then explain what exactly adverse media says ). The customer was asked to explain and provide supporting documentation for the transactions after the period of dormancy ______ on dd/mm/yyyy. The customer did not provide a relevant explanation/is not responsive/or the provided explanations and documentation are not in line with the KYC information we hold on the customer. The activity does not make economic sense and, therefore we find it suspicious and believe that it can be associated with money laundering/terrorist financing.',
  },
  {
    id: 'R-6',
    narrative:
      'The customer activity was alerted by our transaction monitoring system on mm/dd/yyyy by the rule "High risk currency". The customer received/sent XXXXXXXX on mm/dd/yyyy from/to _____(name of the counterparty) ____________account in ___( country name). The counterparty of the transaction was reviewed and material adverse media was identified via public search ( then explain what exactly adverse media says ). The customer was asked to explain and provide supporting documentation for the transactions for the high-risk currency ______ on dd/mm/yyyy. The customer did not provide a relevant explanation/is not responsive/or the provided explanations and documentation are not in line with the KYC information we hold on the customer. The activity does not make economic sense and, therefore we find it suspicious and believe that it can be associated with money laundering/terrorist financing.',
  },
  {
    id: 'R-7',
    narrative:
      'The customer activity was alerted by our transaction monitoring system on mm/dd/yyyy by the rule "Too many transactions under reporting limit (Structuring)". The customer received/sent XXX transactions just below XXXXXX threshold over the period of XXXXXXXX totalling _______. The transactions were conducted with one/several counterparty(ies). The counterparty(ies) of the transaction(s) was/were reviewed and material adverse media was identified via public search ( then explain what exactly adverse media says ). The customer was asked to explain and provide supporting documentation for structured transactions  ______ on mm/dd/yyyy. The customer did not provide a relevant explanation/is not responsive/or the provided explanations and documentation are not in line with the KYC information we hold on the customer. The activity does not make economic sense and, therefore we find it suspicious and believe that it can be associated with money laundering/terrorist financing.',
  },
  {
    id: 'R-9',
    narrative:
      'The customer(s) activity was alerted by our transaction monitoring system on mm/dd/yyyy by the rule "Too many users for a single counterparty". The customers _______(names of the customers) received/sent XXX transactions over the period of XXXXXXXX totalling _______ to/from the same counterparty. The counterparty of the transaction(s) was/were reviewed and material adverse media was identified via public search ( then explain what exactly adverse media says ). The customer was asked to explain and provide supporting documentation for the transactions  ______ on mm/dd/yyyy. The customer did not provide a relevant explanation/is not responsive/or the provided explanations and documentation are not in line with the KYC information we hold on the customer. The activity does not make economic sense and, therefore we find it suspicious and believe that it can be associated with money laundering/terrorist financing.',
  },
  {
    id: 'R-10',
    narrative:
      'The customer(s) activity was alerted by our transaction monitoring system on mm/dd/yyyy by the rule "Too many counterparties for a single customer". The customer  received/sent XXX transactions over the period of XXXXXXXX totalling _______ to/from X ( number ) of counterparties. The counterparties of the transaction(s) wwere reviewed and material adverse media was identified via public search ( then explain what exactly adverse media says ). The customer was asked to explain and provide supporting documentation for the transactions  ______ on mm/dd/yyyy. The customer did not provide a relevant explanation/is not responsive/or the provided explanations and documentation are not in line with the KYC information we hold on the customer. The activity does not make economic sense and, therefore we find it suspicious and believe that it can be associated with money laundering/terrorist financing.',
  },
  {
    id: 'R-11',
    narrative:
      'The customer(s) activity was alerted by our transaction monitoring system on mm/dd/yyyy by the rule "Too many customers for a single external counterparty". The customers _______(names of the customers) received/sent XXX transactions over the period of XXXXXXXX totalling _______ to/from the same external counterparty. The counterparty(ies) of the transaction(s) was/were reviewed and material adverse media was identified via public search ( then explain what exactly adverse media says ). The customers were asked to explain and provide supporting documentation for the transactions  ______ on mm/dd/yyyy. The customers did not provide a relevant explanation/is not responsive/or the provided explanations and documentation are not in line with the KYC information we hold on the customers. The activity does not make economic sense and, therefore we find it suspicious and believe that it can be associated with money laundering/terrorist financing.',
  },
  {
    id: 'R-13',
    narrative:
      'The customer activity was alerted by our transaction monitoring system on mm/dd/yyyy by the rule "Blacklisted Merchant receiver name". This merchant ___(NAME), ADDRESS___ had been previously identified as facilitating financial crime during investigations for other customers for which SARs were filed by us on XXXX, number of SAR. The customer did not provide a relevant explanation/is not responsive/or the provided explanations and documentation are not in line with the KYC information we hold on the customer. We think that this activity is suspicious due to the involvement of the high risk merchant and believe that it can be associated with money laundering/terrorist financing.',
  },
  {
    id: 'R-16',
    narrative:
      'The customer was alerted by our screening system on [caseGenerationDate] due to a hit against adverse media/PEP/sanctions lists. The customer was investigated and sanctions hit was found. The customer was asked to explain and provide supporting documentation regarding the [Sanctions hit details]. The KYC information we hold on the customer does not match the sanctions hit details. The activity does not make economic sense and we have identified significant adverse media or high-risk activity that was not explained/we have true sanctions hit in question, therefore we find it suspicious and believe that it can be associated with money laundering/terrorist financing/sanctions evasion.',
  },
  {
    id: 'R-17',
    narrative:
      'The customer was alerted by our screening system on [caseGenerationDate] due to a hit against adverse media/PEP/sanctions lists. The customer was investigated and sanctions hit was found. The customer was asked to explain and provide supporting documentation regarding the [Sanctions hit details]. The KYC information we hold on the customer does not match the sanctions hit details. The activity does not make economic sense and we have identified significant adverse media or high-risk activity that was not explained/we have true sanctions hit in question, therefore we find it suspicious and believe that it can be associated with money laundering/terrorist financing/sanctions evasion.',
  },
  {
    id: 'R-18',
    narrative:
      'The customer was alerted by our screening system on [caseGenerationDate] due to a hit against adverse media/PEP/sanctions lists. The customer was investigated and sanctions hit was found. The customer was asked to explain and provide supporting documentation regarding the [Sanctions hit details]. The KYC information we hold on the customer does not match the sanctions hit details. The activity does not make economic sense and we have identified significant adverse media or high-risk activity that was not explained/we have true sanctions hit in question, therefore we find it suspicious and believe that it can be associated with money laundering/terrorist financing/sanctions evasion.',
  },
  {
    id: 'R-169',
    narrative:
      'The customer activity was alerted by our screening system on Transactions counterparty screening. The counterparty(ies) of the transactions was/were reviewed and material adverse media was identified via public search ( then explain what exactly adverse media says ). The customer was asked to explain and provide supporting documentation for the transactions with high-risk countries on dd/mm/yyyy. The customer did not provide a relevant explanation/is not responsive/or the provided explanations and documentation are not in line with the KYC information we hold on the customer. The activity does not make economic sense and, therefore we find it suspicious and believe that it can be associated with money laundering/terrorist financing.',
  },
  {
    id: 'R-170',
    narrative:
      'The customer activity was alerted by our screening system on Transactions counterparty screening. The counterparty(ies) of the transactions was/were reviewed and material adverse media was identified via public search ( then explain what exactly adverse media says ). The customer was asked to explain and provide supporting documentation for the transactions with high-risk countries on dd/mm/yyyy. The customer did not provide a relevant explanation/is not responsive/or the provided explanations and documentation are not in line with the KYC information we hold on the customer. The activity does not make economic sense and, therefore we find it suspicious and believe that it can be associated with money laundering/terrorist financing.',
  },
  { id: 'R-22', narrative: 'N/A' },
  {
    id: 'R-24',
    narrative:
      'The customer was alerted by our transaction screening system on mm/dd/yyyy due to a hit against adverse media/PEP/sanctions lists found of the payment reference field. The customer sent/received _______(amount) on mm/dd/yyyy. The customer was asked to explain and provide supporting documentation for the transactions  ______ on mm/dd/yyyy. The customers did not provide a relevant explanation/is not responsive/or the provided explanations and documentation are not in line with the KYC information we hold on the customers. The activity does not make economic sense and we have identified significant adverse media or high-risk activity that was not explained/we have true sanctions hit on the transaction in question, therefore we find it suspicious and believe that it can be associated with money laundering/terrorist financing/sanctions evasion.',
  },
  {
    id: 'R-27',
    narrative:
      'The customer activity was alerted by our transaction monitoring system on mm/dd/yyyy by the rule "Total transaction volume exceeds past period total transaction volume". The customer received/sent from mm/dd/yyyy to mm/dd/yyyy X number of transactions totalling ________. This represents an X% increase in total volume of customer activity compared to the previous XXXX months.   The counterparty(ies) of the transactions was/were reviewed and material adverse media was identified via public search ( then explain what exactly adverse media says ). The customer was asked to explain and provide supporting documentation for the transactions for the high amount of ______ on dd/mm/yyyy. The customer did not provide a relevant explanation/is not responsive/or the provided explanations and documentation are not in line with the KYC information we hold on the customer. The activity does not make economic sense and, therefore we find it suspicious and believe that it can be associated with money laundering/terrorist financing.',
  },
  {
    id: 'R-30',
    narrative:
      'The customer activity was alerted by our transaction monitoring system on mm/dd/yyyy by the rule "High velocity user". The customer received/sent from mm/dd/yyyy to mm/dd/yyyy X number of transactions totalling ________.   The counterparty(ies) of the transactions was/were reviewed and material adverse media was identified via public search ( then explain what exactly adverse media says ). The customer was asked to explain and provide supporting documentation for the high velocity of transactions______ on dd/mm/yyyy. The customer did not provide a relevant explanation/is not responsive/or the provided explanations and documentation are not in line with the KYC information we hold on the customer. The activity does not make economic sense and, therefore we find it suspicious and believe that it can be associated with money laundering/terrorist financing.',
  },
  {
    id: 'R-32',
    narrative:
      'The customer was alerted by our screening system on [caseGenerationDate] due to a hit against adverse media/PEP/sanctions lists found in the bank name field. The customer was hit by [Sanctions Hit Details]. The customer was asked to explain and provide supporting documentation regarding the [Sanctions hit details]. The KYC information we hold on the customer does not match the sanctions hit details. The activity does not make economic sense and we have identified significant adverse media or high-risk activity that was not explained/we have true sanctions hit in question, therefore we find it suspicious and believe that it can be associated with money laundering/terrorist financing/sanctions evasion.',
  },
  {
    id: 'R-41',
    narrative:
      'The customer activity was alerted by our transaction monitoring system on mm/dd/yyyy by the rule "Transaction outflow and inflow pattern". The customer received/sent from mm/dd/yyyy to mm/dd/yyyy X number of transactions totalling ________.   The counterparty(ies) of the transactions was/were reviewed and material adverse media was identified via public search ( then explain what exactly adverse media says ). The customer was asked to explain and provide supporting documentation for outflows and inflows______ on dd/mm/yyyy. The customer did not provide a relevant explanation/is not responsive/or the provided explanations and documentation are not in line with the KYC information we hold on the customer. The activity does not make economic sense and, therefore we find it suspicious and believe that it can be associated with money laundering/terrorist financing.',
  },
  {
    id: 'R-52',
    narrative:
      'The customer activity was alerted by our transaction monitoring system on mm/dd/yyyy by the rule "Same IP address for too many users". The customers turned out to be associated with each other and were located at the same address.   The counterparty(ies) of the transactions was/were reviewed and material adverse media was identified via public search ( then explain what exactly adverse media says ). The customer was asked to explain and provide supporting documentation for the links with different customers______ on dd/mm/yyyy. The customer did not provide a relevant explanation/is not responsive/or the provided explanations and documentation are not in line with the KYC information we hold on the customer. The activity does not make economic sense and, therefore we find it suspicious and believe that it can be associated with money laundering/terrorist financing/sanction evasion.',
  },
  {
    id: 'R-53',
    narrative:
      'The customer activity was alerted by our transaction monitoring system on mm/dd/yyyy by the rule "Same card used by too many users". The relevant customers\' activity was reviewed for the period from mm/dd/yyyy to mm/dd/yyyy for the total X number of transactions amounting to _____. The customers were asked to explain and provide supporting documentation to confirm that the cards used in the transactions belong to them______ on dd/mm/yyyy. The customer did not provide a relevant explanation/is not responsive/or the provided explanations and documentation are not in line with the KYC information we hold on the customer. The activity does not make economic sense and, therefore we find it suspicious and believe that it can be associated with money laundering/terrorist financing/card not present fraud.',
  },
  {
    id: 'R-55',
    narrative:
      'The customer activity was alerted by our transaction monitoring system on mm/dd/yyyy by the rule "Same sender user using too many payment identifiers". The customer activity was reviewed from mm/dd/yyyy to mm/dd/yyyy for the total X number of transactions amounting to _____. The customer was asked to explain and provide supporting documentation to confirm that the cards used in the transactions belong to the customer______ on dd/mm/yyyy. The customer did not provide a relevant explanation/is not responsive/or the provided explanations and documentation are not in line with the KYC information we hold on the customer. The activity does not make economic sense and, therefore we find it suspicious and believe that it can be associated with money laundering/terrorist financing/card not present fraud.',
  },
  {
    id: 'R-69',
    narrative:
      'The customer activity was alerted by our transaction monitoring system on mm/dd/yyyy by the rule "Customer money flow is above the expected volume". The customer received/sent from mm/dd/yyyy to mm/dd/yyyy X number of transactions totalling ________.   The counterparty(ies) of the transactions was/were reviewed and material adverse media was identified via public search ( then explain what exactly adverse media says ). The customer was asked to explain and provide supporting documentation for an increase in the volume/value of transactions  ______ on mm/dd/yyyy. The customer did not provide a relevant explanation/is not responsive/or the provided explanations and documentation are not in line with the KYC information we hold on the customer. The activity does not make economic sense and, therefore we find it suspicious and believe that it can be associated with money laundering/terrorist financing.',
  },
  {
    id: 'R-77',
    narrative:
      'The customer activity was alerted by our transaction monitoring system on mm/dd/yyyy by the rule "Too many transactions to high risk country". The customer made  X outgoing transfers from mm/dd/yyyy to mm/dd/yyyy totalling XXXXX to a multiple/single counterparties. The counterparty of the transaction was reviewed and material adverse media was identified via public search ( then explain what exactly adverse media says ). The customer was asked to explain and provide supporting documentation for the transactions going to a high risk country ______ on dd/mm/yyyy. The customer did not provide a relevant explanation/is not responsive/or the provided explanations and documentation are not in line with the KYC information we hold on the customer. The activity does not make economic sense and, therefore we find it suspicious and believe that it can be associated with money laundering/terrorist financing.',
  },
  {
    id: 'R-88',
    narrative:
      'The customer activity was alerted by our transaction monitoring system on mm/dd/yyyy by the rule "Unexpected IP address for user". The customer transactions for the period of mm/dd/yyyy to mm/dd/yyyy were reviewed. The customer was asked to explain and provide supporting documentation for the unexpected IP change______ on mm/dd/yyyy. The customer did not provide a relevant explanation/is not responsive/or the provided explanations and documentation are not in line with the KYC information we hold on the customer. The activity does not make economic sense and, therefore we find it suspicious and believe that it can be associated with money laundering/terrorist financing/sanction evasion/fraud.',
  },
  { id: 'R-101', narrative: 'N/A' },
  {
    id: 'R-111',
    narrative: 'N/A',
  },
  {
    id: 'R-113',
    narrative:
      'The customer activity was alerted by our transaction monitoring system on mm/dd/yyyy by the rule "User city changes too many times based on IP address". The customer transactions for the period of mm/dd/yyyy to mm/dd/yyyy were reviewed. The customer was asked to explain and provide supporting documentation for the multiple unexpected IP change ______ on mm/dd/yyyy. The customer did not provide a relevant explanation/is not responsive/or the provided explanations and documentation are not in line with the KYC information we hold on the customer. The activity does not make economic sense and, therefore we find it suspicious and believe that it can be associated with money laundering/terrorist financing/sanction evasion/fraud.',
  },
  { id: 'R-114', narrative: " ,	Card-issued country isn't in the whitelist	N/A" },
  {
    id: 'R-117',
    narrative:
      'The customer activity was alerted by our transaction monitoring system on mm/dd/yyyy by the rule "Transaction amount matches a pattern". The customer received/sent from mm/dd/yyyy to mm/dd/yyyy X number of transactions totalling ________ which is indicative of a know money laundering/terrorist financing typology called ___________.   The counterparty(ies) of the transactions was/were reviewed and material adverse media was identified via public search ( then explain what exactly adverse media says ). The customer was asked to explain and provide supporting documentation for outflows and inflows______ on dd/mm/yyyy. The customer did not provide a relevant explanation/is not responsive/or the provided explanations and documentation are not in line with the KYC information we hold on the customer. The activity does not make economic sense and, therefore we find it suspicious and believe that it can be associated with money laundering/terrorist financing.',
  },
  {
    id: 'R-118',
    narrative:
      'The customer activity was alerted by our transaction monitoring system on mm/dd/yyyy by the rule "Card holder name doesn\'t match user name". The customer activity was reviewed from mm/dd/yyyy to mm/dd/yyyy for the total X number of transactions amounting to _____. The customer was asked to explain and provide supporting documentation to confirm that the cards used in the transactions belong to him/her_________ on dd/mm/yyyy. The customer did not provide a relevant explanation/is not responsive/or the provided explanations and documentation are not in line with the KYC information we hold on the customer. The activity does not make economic sense and, therefore we find it suspicious and believe that it can be associated with money laundering/terrorist financing/card not present fraud.',
  },
  {
    id: 'R-119',
    narrative:
      'The customer(s) activity was alerted by our transaction monitoring system on mm/dd/yyyy by the rule "High traffic between the same parties". The customers _______(names of the customers) received/sent XXX transactions over the period of XXXXXXXX totalling _______ to/from the same parties. The counterparty of the transaction(s) was/were reviewed and material adverse media was identified via public search ( then explain what exactly adverse media says ). The customer(s) was/were asked to explain and provide supporting documentation for the transactions  ______ on mm/dd/yyyy. The customer(s) did not provide a relevant explanation/is/are not responsive/or the provided explanations and documentation are not in line with the KYC information we hold on the customer(s). The activity does not make economic sense and, therefore we find it suspicious and believe that it can be associated with money laundering/terrorist financing.',
  },
  {
    id: 'R-121',
    narrative:
      'The customer activity was alerted by our transaction monitoring system on mm/dd/yyyy by the rule "Average transactions exceed past period average". The customer received/sent from mm/dd/yyyy to mm/dd/yyyy X number of transactions totalling ________. This represents an X% increase in the average volume of customer activity compared to the previous XXXX months.   The counterparty(ies) of the transactions was/were reviewed and material adverse media was identified via public search ( then explain what exactly adverse media says ). The customer was asked to explain and provide supporting documentation for the transactions for the high amount of ______ on mm/dd/yyyy. The customer did not provide a relevant explanation/is not responsive/or the provided explanations and documentation are not in line with the KYC information we hold on the customer. The activity does not make economic sense and, therefore we find it suspicious and believe that it can be associated with money laundering/terrorist financing.',
  },
  {
    id: 'R-122',
    narrative:
      'The customer activity was alerted by our transaction monitoring system on mm/dd/yyyy by the rule "Average transaction amount exceed past period average". The customer received/sent from mm/dd/yyyy to mm/dd/yyyy X number of transactions totalling ________. This represents an X% increase in the average amount of customer activity compared to the previous XXXX months.   The counterparty(ies) of the transactions was/were reviewed and material adverse media was identified via public search ( then explain what exactly adverse media says ). The customer was asked to explain and provide supporting documentation for the transactions for the high amount of ______ on mm/dd/yyyy. The customer did not provide a relevant explanation/is not responsive/or the provided explanations and documentation are not in line with the KYC information we hold on the customer. The activity does not make economic sense and, therefore we find it suspicious and believe that it can be associated with money laundering/terrorist financing.',
  },
  {
    id: 'R-123',
    narrative:
      'The customer activity was alerted by our transaction monitoring system on mm/dd/yyyy by the rule "Too many counterparty countries". The customer made  X outgoing/incoming transfers from mm/dd/yyyy to mm/dd/yyyy totalling XXXXX to/from multiple countries, such as (list the countries). The counterparties of the transactions were reviewed and material adverse media was identified via public search ( then explain what exactly adverse media says ). The customer was asked to explain and provide supporting documentation for the transactions with multiple countries on dd/mm/yyyy. The customer did not provide a relevant explanation/is not responsive/or the provided explanations and documentation are not in line with the KYC information we hold on the customer. The activity does not make economic sense and, therefore we find it suspicious and believe that it can be associated with money laundering/terrorist financing.',
  },
  {
    id: 'R-124',
    narrative:
      'The customer activity was alerted by our transaction monitoring system on mm/dd/yyyy by the rule "Too many round transactions". The customer made  X outgoing/incoming transfers from mm/dd/yyyy to mm/dd/yyyy totalling XXXXX to/from all in round amounts. The counterparties of the transactions were reviewed and material adverse media was identified via public search ( then explain what exactly adverse media says ). The customer was asked to explain and provide supporting documentation for the round amounts of transactions on dd/mm/yyyy. The customer did not provide a relevant explanation/is not responsive/or the provided explanations and documentation are not in line with the KYC information we hold on the customer. The activity does not make economic sense and, therefore we find it suspicious and believe that it can be associated with money laundering/terrorist financing.',
  },
  {
    id: 'R-125',
    narrative:
      'The customer activity was alerted by our transaction monitoring system on mm/dd/yyyy by the rule "High percentage of unsuccessful state transactions". The customer made  X outgoing/incoming transfers from mm/dd/yyyy to mm/dd/yyyy totalling XXXXX to/from which were unsuccessful. The customer was asked to explain and provide supporting documentation for the unsuccessful transactions on dd/mm/yyyy. The customer did not provide a relevant explanation/is not responsive/or the provided explanations and documentation are not in line with the KYC information we hold on the customer. The activity does not make economic sense and, therefore we find it suspicious and believe that it can be associated with money laundering/terrorist financing/fraud.',
  },
  {
    id: 'R-126',
    narrative:
      'The customer(s) activity was alerted by our transaction monitoring system on mm/dd/yyyy by the rule "High volume between same parties". The customers _______(names of the customers) received/sent XXX transactions over the period of XXXXXXXX totalling _______ to/from the same parties. The counterparty of the transaction(s) was/were reviewed and material adverse media was identified via public search ( then explain what exactly adverse media says ). The customer(s) was/were asked to explain and provide supporting documentation for the transactions between the same parties  ______ on mm/dd/yyyy. The customer(s) did not provide a relevant explanation/is/are not responsive/or the provided explanations and documentation are not in line with the KYC information we hold on the customer(s). The activity does not make economic sense and, therefore we find it suspicious and believe that it can be associated with money laundering/terrorist financing.',
  },
  {
    id: 'R-127',
    narrative:
      'The customer(s) activity was alerted by our transaction monitoring system on mm/dd/yyyy by the rule "Same payment details used too many times". The customer received/sent XXX transactions over the period of XXXXXXXX totalling _______ with the same payment details. The counterparty of the transaction(s) was/were reviewed and material adverse media was identified via public search ( then explain what exactly adverse media says ). The customer(s) was/were asked to explain and provide supporting documentation for the transactions using the same details on mm/dd/yyyy. The customer(s) did not provide a relevant explanation/is/are not responsive/or the provided explanations and documentation are not in line with the KYC information we hold on the customer(s). The activity does not make economic sense and, therefore we find it suspicious and believe that it can be associated with money laundering/terrorist financing.',
  },
  {
    id: 'R-128',
    narrative:
      'The customer was alerted by our screening system on [caseGenerationDate] due to a hit against adverse media/PEP/sanctions lists. The alert was generated on the legal entity name/shareholder/director of the customer. The customer was investigated and sanctions hit was found. The customer was asked to explain and provide supporting documentation regarding the [Sanctions hit details]. The KYC information we hold on the customer does not match the sanctions hit details. The activity does not make economic sense and we have identified significant adverse media or high-risk activity that was not explained/we have true sanctions hit in question, therefore we find it suspicious and believe that it can be associated with money laundering/terrorist financing/sanctions evasion.',
  },
  {
    id: 'R-130',
    narrative:
      'Too many round transactions to the same user	The customer activity was alerted by our transaction monitoring system on mm/dd/yyyy by the rule "Too many round transactions to the same user". The customer made  X outgoing/incoming transfers from mm/dd/yyyy to mm/dd/yyyy totalling XXXXX to/from all in round amounts. The counterparties of the transactions were reviewed and material adverse media was identified via public search ( then explain what exactly adverse media says ). The customer was asked to explain and provide supporting documentation for the round amounts of transactions with the same counterparties on dd/mm/yyyy. The customer did not provide a relevant explanation/is not responsive/or the provided explanations and documentation are not in line with the KYC information we hold on the customer. The activity does not make economic sense and, therefore we find it suspicious and believe that it can be associated with money laundering/terrorist financing.',
  },
  {
    id: 'R-131',
    narrative:
      'Number of transactions exceed past period total number of transactions	The customer activity was alerted by our transaction monitoring system on mm/dd/yyyy by the rule "Number of transactions exceed past period total number of transactions". The customer received/sent from mm/dd/yyyy to mm/dd/yyyy X number of transactions totalling ________. This represents an X% increase in total number of customer activity compared to the previous XXXX months/days/weeks.   The counterparty(ies) of the transactions was/were reviewed and material adverse media was identified via public search ( then explain what exactly adverse media says ). The customer was asked to explain and provide supporting documentation for the transactions for the high amount of ______ on dd/mm/yyyy. The customer did not provide a relevant explanation/is not responsive/or the provided explanations and documentation are not in line with the KYC information we hold on the customer. The activity does not make economic sense and, therefore we find it suspicious and believe that it can be associated with money laundering/terrorist financing.',
  },
  { id: 'R-132', narrative: 'N/A' },
  { id: 'R-133', narrative: 'N/A' },
  {
    id: 'R-150',
    narrative:
      'The customer activity was alerted by our transaction monitoring system on mm/dd/yyyy by the rule "GTI score too high". The customer received/sent from mm/dd/yyyy to mm/dd/yyyy X number of transactions totalling ________ from/to countries with high terrorism activity index.   The counterparty(ies) of the transactions was/were reviewed and material adverse media was identified via public search ( then explain what exactly adverse media says ). The customer was asked to explain and provide supporting documentation for the transactions with high-risk countries on dd/mm/yyyy. The customer did not provide a relevant explanation/is not responsive/or the provided explanations and documentation are not in line with the KYC information we hold on the customer. The activity does not make economic sense and, therefore we find it suspicious and believe that it can be associated with terrorist financing.',
  },
]
