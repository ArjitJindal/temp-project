import { titleCaseWord } from '@flagright/lib/utils/humanize'
import { enumType } from '../../generators/US/SAR/resources/enumType'

export function removeActivityBlockOrder(jsonSchema: any) {
  jsonSchema['definitions']['ActivityNarrativeInformationType'] = {
    required: ['ActivityNarrativeText'],
    properties: {
      ActivityNarrativeText: {
        maxLength: 16000,
        type: 'string',
        title: 'Narrative (description)',
        description:
          'This element records the narrative description associated with the suspicious activity. The narrative must provide a clear, complete, and concise description of the activity, including what was unusual or irregular that caused suspicion. ',
        'ui:schema': { 'ui:subtype': 'NARRATIVE' },
      },
    },
    type: 'object',
  }
  jsonSchema['definitions']['Activity']['allOf'][1]['properties'][
    'ActivityNarrativeInformation'
  ] = {
    $ref: '#/definitions/ActivityNarrativeInformationType',
    title: 'Narrative',
    description:
      'This element is the container for information about narrative description associated with the FinCEN SAR.',
  }
  return jsonSchema
}

export function manualValidation(jsonSchema: any) {
  if (!jsonSchema || typeof jsonSchema !== 'object') {
    return jsonSchema
  }

  if (!jsonSchema['definitions']) {
    jsonSchema['definitions'] = {}
  }

  jsonSchema['definitions']['RawZIPCodeType'] = {
    type: 'string',
    maxLength: 9,
    pattern: '^[a-zA-Z0-9]+$',
    title: 'Raw ZIP code',
  }

  if (!jsonSchema['definitions']['AddressType']) {
    return jsonSchema
  }

  if (!jsonSchema['definitions']['AddressType']['properties']) {
    jsonSchema['definitions']['AddressType']['properties'] = {}
  }

  jsonSchema['definitions']['AddressType']['properties']['RawZIPCode'] = {
    $ref: '#/definitions/RawZIPCodeType',
  }

  return jsonSchema
}

export function agumentEnumFintracStr() {}

export function agumentUiSchemaFintracStr(jsonSchema: any) {
  if (!jsonSchema) {
    return
  }
  const enumType = 'indicator'
  const phoneType = 'telephoneNumber'
  const countryType = 'countrycode'
  const stateType = 'statecode'
  const emailType = 'emailaddress'
  const urlType = 'url'
  Object.entries(jsonSchema).forEach(([key, value]: [string, any]) => {
    const lowerKey = key.toLowerCase()
    if (lowerKey.includes(enumType)) {
      value['ui:schema'] = {
        'ui:subtype': 'FINCEN_INDICATOR',
      }
    }
    if (lowerKey.includes(phoneType) || value?.['$ref']?.includes(phoneType)) {
      value['ui:schema'] = {
        'ui:subtype': 'FINCEN_PHONE_NUMBER',
      }
    }
    if (
      lowerKey.includes(countryType) ||
      value?.['$ref']?.includes(countryType)
    ) {
      value['ui:schema'] = {
        'ui:subtype': 'COUNTRY',
      }
    }
    if (lowerKey.includes(stateType) || value?.['$ref']?.includes(stateType)) {
      value['ui:schema'] = {
        'ui:subtype': 'COUNTRY_REGION',
        'ui:countryField': 'RawCountryCodeText',
      }
    }
    if (lowerKey.includes(emailType) || value?.['$ref']?.includes(emailType)) {
      value['ui:schema'] = {
        'ui:subtype': 'FINCEN_ELECTRONIC_ADDRESS',
        'ui:value': 'EMAIL',
      }
    }

    if (lowerKey.includes(urlType) || value?.['$ref']?.includes(urlType)) {
      value['ui:schema'] = {
        'ui:subtype': 'FINCEN_ELECTRONIC_ADDRESS',
        'ui:value': 'URL',
      }
    }

    // Recursively apply if nested
    if (value?.properties) {
      agumentUiSchemaFintracStr(value.properties)
    }
    if (value?.items?.allOf) {
      value.items.allOf.forEach((value) => {
        if (value['then'] && value['then']['properties']) {
          agumentUiSchemaFintracStr(value['then']['properties'])
        }
      })
    }
  })

  return jsonSchema
}

export function agumentAustracSmr(jsonSchema: any, prevKey: string = '') {
  if (!jsonSchema) {
    return
  }
  Object.entries(jsonSchema).forEach(([key, value]: [string, any]) => {
    if (value['type'] === 'array') {
      if (
        key === 'phone' ||
        key === 'email' ||
        key === 'acctSigName' ||
        key === 'digitalCurrencyWallet' ||
        key === 'benName' ||
        key === 'holderName' ||
        key === 'citizenCountry'
      ) {
        switch (key) {
          case 'phone':
            value['title'] = 'Phone numbers'
            value['description'] = 'A list of contact telephone numbers.'
            break
          case 'email':
            value['title'] = 'Email addresses'
            value['description'] = 'A list of email addresses.'
            break
          case 'acctSigName':
            value['title'] = 'Signatories'
            value['description'] = 'A list of name of a person or organisation'
            break
          case 'digitalCurrencyWallet':
            value['title'] = 'Digital currency wallet addresses'
            value['description'] =
              'A list of the identifying address of a digital currency wallet.'
            break
          case 'benName':
            value['title'] = 'Beneficial owners'
            value['description'] =
              "List the names of the organisation's beneficial owners."
            break
          case 'holderName':
            value['title'] = 'Office holders'
            value['description'] =
              "List the names of the organisation's office holders."
            break
          case 'citizenCountry':
            value['title'] = 'Citizenship countries'
            value['description'] =
              'A list of countries the person or organisation is a citizen of.'
            break
        }
        value['items'] = {
          type: 'object',
          properties: {
            [key]: {
              ...value['items'],
            },
          },
        }
      } else {
        const title = value['items']['title']
        const description = value['items']['description']
        value['title'] = title
        value['description'] = description
      }
    }
    if (key === 'mainAddress') {
      value['title'] = 'Main address'
      value['description'] =
        "The full street address of the person's residential address ororganisation's business address; or as much of the address as known. This address cannot be a post box or similar address."
    }
    if (key === 'postalAddress') {
      value['title'] = 'Other address'
      value['description'] =
        'Any other address associated with the person or organisation; or as much of the address as known. This address can be a street or post box address.'
    }
    if (key === 'altName') {
      value['title'] = 'Alternative name'
      value['description'] =
        'Any other name(s) the person or organisation is commonly known by or trades under.'
    }
    if (key === 'account') {
      value['title'] = 'Accounts'
      value['description'] = 'A list of accounts.'
    }
    if (key === 'idIssueDate') {
      value['title'] = 'Id issue date'
    }
    if (key === 'idExpiryDate') {
      value['title'] = 'Id expiry date'
    }
    if (key === 'identification') {
      value['title'] = 'Identification document'
      value['description'] =
        'Details of the documents sighted or used to confirm the identity of a person or organisation.'
    }
    if (key === 'electDataSrc') {
      value['title'] = 'Electronic data source'
      value['description'] =
        'Details of the documents sighted or used to confirm the identity of a person or organisation.'
    }
    if (key === 'deviceIdentifier') {
      value['title'] = 'Device identifier'
      value['description'] = 'Description of a device used to verify identity.'
    }
    if (key === 'personIsCustomer') {
      value['title'] = 'Person is customer'
      value['description'] =
        'Indicate whether or not the person or organisation is a customer of the reporting entity.'
      value['ui:schema'] = {
        'ui:subtype': 'FINCEN_INDICATOR',
      }
    }
    if (key === 'deviceIdentifier') {
      value['title'] = 'Device identifier'
      value['description'] =
        'The device identifier type and unique identifier of the device or system used, such as an IP address, MAC address, etc.'
    }
    if (key === 'partyIsCustomer') {
      value['title'] = 'Party is customer'
      value['description'] =
        'Indicate whether or not the other party is a customer of the reporting entity.'
      value['ui:schema'] = {
        'ui:subtype': 'FINCEN_INDICATOR',
      }
    }
    if (key === 'partyIsAgent') {
      value['title'] = 'Party is agent'
      value['description'] =
        'Indicate whether or not the other party is an authorised agent of a person or organisation listed as a suspicious person.'
      value['ui:schema'] = {
        'ui:subtype': 'FINCEN_INDICATOR',
      }
    }
    if (key === 'txnType') {
      value['title'] = 'Transaction type code'
      value['description'] = 'Code for the type of transaction or activity.'
    }
    if (key === 'txnCompleted') {
      value['title'] = 'Transaction completed'
      value['description'] =
        'Indicate whether the transaction or activity was completed.'
      value['ui:schema'] = {
        'ui:subtype': 'FINCEN_INDICATOR',
      }
    }
    if (key === 'txnRefNo') {
      value['title'] = 'Transaction reference number'
      value['description'] =
        'Any reference number allocated to the transaction or activity by the reporting entity.'
    }
    if (key === 'foreignCurr') {
      value['title'] = 'Foreign currency'
      value['description'] =
        'Currency code and value of any foreign currency involved.'
    }
    if (key === 'digitalCurrency') {
      value['title'] = 'Digital currency'
      value['description'] =
        'Digital currency code, description, value, backing asset, fiat currency value and blockchain reference of any digital currency involved.'
    }
    if (key === 'senderDrawerIssuer') {
      value['title'] = 'Sender drawer issuer'
      value['description'] =
        'Details of the source of the funds involved in a suspicious transaction or activity, if any'
    }
    if (key === 'payee') {
      value['title'] = 'Payee'
      value['description'] =
        'Details of the destination of the funds in relation to a payee, if any.'
    }
    if (key === 'beneficiary') {
      value['title'] = 'Beneficiary'
      value['description'] =
        'Details of the destination of the funds in relation to a beneficiary, if any.'
    }
    if (key === 'otherInstitution') {
      value['title'] = 'Other institution'
      value['description'] =
        'Details of any institution other than the sending or receiving institutions involved (i.e. any intermediary institution).'
    }
    if (key === 'documentation' && value.oneOf) {
      delete value.oneOf
      value['title'] = 'Documentations'
      value['description'] =
        'Describe any documentation held in relation to this organisation (e.g. articles of association, business cards, business/company registration certificate, trust deeds, etc.).'
      value['type'] = 'array'
      value['items'] = {
        type: 'object',
        properties: {
          documentation: {
            maxLength: 4000,
            type: 'string',
            title: 'Documentation',
            description: 'Description of relevant documents held.',
          },
        },
      }
    }
    if (key === 'DigitalCurrency' && value['properties']) {
      value['properties']['code']['title'] = 'Code'
      value['properties']['code']['description'] =
        'The code or symbol associated with the digital currency, e.g. BTC for Bitcoin, ETH for Ethereum.'
      value['properties']['description']['title'] = 'Description'
      value['properties']['description']['description'] =
        'The description or name associated with the digital currency, e.g. Bitcoin, Ethereum'
    }
    if (key === 'backingAsset') {
      value['title'] = 'Backing asset'
      value['description'] =
        'The asset or currency that the digital currency is backed by, e.g. USD, EUR.'
    }
    if (key === 'fiatCurrencyValue') {
      value['title'] = 'Fiat currency value'
      value['description'] =
        'The monetary or settlement value of the digital currency in fiat currency, including the three letter ISO currency code for the fiat currency.'
    }
    if (key === 'blockchainTransactionId') {
      value['title'] = 'Blockchain transaction ID'
      value['description'] =
        'The transaction hash (i.e. identifier) of the blockchain transaction, if applicable for this digital currency transfer.'
    }
    if (key === 'descOfDocs' && value.oneOf) {
      delete value.oneOf
      value['title'] = 'Documentations'
      value['description'] =
        'Documentation held in relation to the unidentified person.'
      value['type'] = 'array'
      value['items'] = {
        type: 'object',
        properties: {
          documentation: {
            maxLength: 4000,
            type: 'string',
            title: 'Description of Documentation',
            description: 'Description of relevant documents held.',
          },
        },
      }
    }
    if (key === 'typeOther') {
      value['title'] = 'Other description'
    }
    if (key === 'acctOpenDate') {
      value['title'] = 'Account open date'
      value['description'] =
        'Date with extended allowable range used within SMRs.'
    }
    if (key === 'acctBal') {
      value['title'] = 'Account balance'
      value['description'] = 'Positive or negative currency amount.'
    }
    if (prevKey === 'identification') {
      if (key === 'idIssueDate') {
        value['title'] = 'Id issue date'
      }
      if (key === 'idExpiryDate') {
        value['title'] = 'Id expiry date'
      }
    }
    if (
      key === 'IndOccCode' ||
      key === 'SignedAmount' ||
      key === 'Amount' ||
      key === 'DecimalNumber'
    ) {
      delete value['pattern']
    }
    if (key === 'IndOccCode') {
      value['title'] = 'Industry/Occupation code'
      value['description'] = 'Code for the type of individual occupation.'
    }
    if (
      (prevKey === 'senderDrawerIssuer' ||
        prevKey === 'payee' ||
        prevKey === 'beneficiary') &&
      key === 'sameAsSuspPerson'
    ) {
      value['title'] = 'Same as suspicious person'
      value['description'] =
        'Use this when the sender/drawer/issuer is a person or organisation to which this suspicious matter relates.'
      value['required'] = ['Reference Id']
      value['properties'] = {
        'Reference Id': {
          title: 'Reference ID',
          description:
            'The index of the person or organisation to which this suspicious matter relates. Pick index from the list of persons or organisations from rows of the Part C (1 based indexing)',
          type: 'string',
        },
      }
    }
    if (
      (prevKey === 'senderDrawerIssuer' ||
        prevKey === 'payee' ||
        prevKey === 'beneficiary') &&
      key === 'sameAsOtherPerson'
    ) {
      value['title'] = 'Same as other person'
      value['description'] =
        'Use this when the sender/drawer/issuer is another party involved in this suspicious matter.'
      value['required'] = ['Reference Id']
      value['properties'] = {
        'Reference Id': {
          title: 'Reference Id',
          description:
            'The index of the person or organisation to which this suspicious matter relates. Pick index from the list of persons or organisations from rows of the Part D (1 based indexing)',
          type: 'string',
        },
      }
    }
    if (
      (prevKey === 'senderDrawerIssuer' ||
        prevKey === 'payee' ||
        prevKey === 'beneficiary') &&
      key === 'other'
    ) {
      value['title'] = 'Other person'
      value['description'] =
        'Use this sequence when the sender/drawer/issuer is neither a person or organisation to which this suspicious matter relates or another party involved in this suspicious matter.'
      value['type'] = 'object'
    }
    if (prevKey === 'senderDrawerIssuer' && key === 'sendingInstitution') {
      value['title'] = 'Sending institution'
      value['description'] =
        'Provide details of any sending institution(s) involved or from where the funds originated.'
    }
    if (
      (prevKey === 'payee' || prevKey === 'beneficiary') &&
      key === 'receivingInstitution'
    ) {
      value['title'] = 'Receiving institution'
      value['description'] =
        'Provide details of any receiving or destination institutions involved in the suspicious transaction or activity.'
    }
    if (prevKey === 'TfrType') {
      if (key === 'money') {
        value['title'] = 'Money'
        value['description'] =
          'Use this to indicate when the transfer involved the movement of funds.'
      }
      if (key === 'property') {
        value['title'] = 'Property'
        value['description'] =
          'Use this to indicate then the transfer involved property.'
      }
    }

    if (key === 'designatedSvc') {
      value['title'] = 'Designated services'
      value['name'] = 'Designated service'
      value['description'] =
        'List the designated services to which the suspicious matter relates.'
    }
    if (key === 'suspReasons') {
      value['title'] = 'Suspicion reason'
      value['name'] = 'Suspicion reason'
      value['description'] =
        'List the most appropriate reason(s) for the suspicion formed in relation to the matter being reported.'
    }
    if (key === 'designatedSvcProvided') {
      value['title'] = 'Designated services provided'
      value['description'] =
        'Indicate whether a service or product, which is categorised as a designated service, has been provided to a person or organisation to which the suspicious matter relates.'
      value['ui:schema'] = {
        'ui:subtype': 'FINCEN_INDICATOR',
      }
    }
    if (key === 'designatedSvcRequested') {
      value['title'] = 'Designated services requested'
      value['description'] =
        'Indicate whether the person or organisation to which this suspicious matter relates requested the provision of a service or product, which is categorised as a designated service, from the reporting entity'
      value['ui:schema'] = {
        'ui:subtype': 'FINCEN_INDICATOR',
      }
    }
    if (key === 'designatedSvcEnquiry') {
      value['title'] = 'Designated services enquiry'
      value['description'] =
        'Indicate whether the person or organisation to which this suspicious matter relates enquired about the provision of a service or product, which could be categorised as a designated service. However, the person or organisation and the reporting entity did not proceed further by requesting or providing the service or product respectively.'
      value['ui:schema'] = {
        'ui:subtype': 'FINCEN_INDICATOR',
      }
    }
    if (key === 'prevReported') {
      value['title'] = 'Previous or other agency reports'
      value['name'] = 'Previous or other agency reports'
      value['description'] =
        'List the date and reference number of any previous suspicious matter reports given to AUSTRAC relating to the person(s) or organisation(s) in which the suspicious matter relates.'
    }
    if (key === 'otherAusGov') {
      value['title'] = 'Other Australian government agency'
      value['name'] = 'Other Australian government agency'
      value['description'] =
        'List other Australian government bodies the suspicious matter has been or will be reported to.'
    }
    if (value.title) {
      value.title = titleCaseWord(value.title, true)
      value['name'] = value.title
    }

    // add enum names for showing description on ui
    if (enumType[key]) {
      value.enumNames = enumType[key]
    }

    if (value?.properties) {
      // Recursively apply if nested
      agumentAustracSmr(value.properties, key)
    }
    if (value?.allOf && value?.allOf[1] && value?.allOf[1].properties) {
      agumentAustracSmr(value?.allOf[1].properties, key)
    }
  })

  return jsonSchema
}

export function agumentUiSchemaAustracSmr(jsonSchema: any) {
  if (!jsonSchema) {
    return
  }
  const enumType = 'indicator'
  const countryType = 'Country'
  Object.entries(jsonSchema).forEach(([key, value]: [string, any]) => {
    if (key.includes(enumType)) {
      value['ui:schema'] = {
        'ui:subtype': 'FINCEN_INDICATOR',
      }
    }

    if (key === countryType || value?.['$ref']?.includes(countryType)) {
      value['ui:schema'] = {
        'ui:subtype': 'COUNTRY',
      }
    }

    // Recursively apply if nested
    if (value?.properties) {
      agumentUiSchema(value.properties)
    }
    if (value?.allOf && value?.allOf[1] && value?.allOf[1].properties) {
      agumentUiSchema(value?.allOf[1].properties)
    }
  })

  return jsonSchema
}

export function agumentUiSchema(jsonSchema: any) {
  if (!jsonSchema) {
    return
  }
  const enumType = 'Indicator'
  const phoneType = 'PhoneNumberType'
  const countryType = 'RawCountryCodeText'
  const stateType = 'RawStateCodeText'
  const emailType = 'ElectronicAddressType'
  Object.entries(jsonSchema).forEach(([key, value]: [string, any]) => {
    if (key.includes(enumType)) {
      value['ui:schema'] = {
        'ui:subtype': 'FINCEN_INDICATOR',
      }
    }
    if (key === phoneType || value?.['$ref']?.includes(phoneType)) {
      // TODO: fix for STR
      // value['ui:schema'] = {
      //   'ui:subtype': 'FINCEN_PHONE_NUMBER',
      // }
    }
    if (key === countryType || value?.['$ref']?.includes(countryType)) {
      value['ui:schema'] = {
        'ui:subtype': 'COUNTRY',
      }
    }
    if (key === stateType || value?.['$ref']?.includes(stateType)) {
      value['ui:schema'] = {
        'ui:subtype': 'COUNTRY_REGION',
        'ui:countryField': 'RawCountryCodeText',
      }
    }
    // TODO: fix for CTR
    if (key === emailType || value?.['$ref']?.includes(emailType)) {
      // value['ui:schema'] = {
      //   'ui:subtype': 'FINCEN_ELECTRONIC_ADDRESS',
      // }
    }

    // Recursively apply if nested
    if (value?.properties) {
      agumentUiSchema(value.properties)
    }
    if (value?.allOf && value?.allOf[1] && value?.allOf[1].properties) {
      agumentUiSchema(value?.allOf[1].properties)
    }
  })

  return jsonSchema
}
