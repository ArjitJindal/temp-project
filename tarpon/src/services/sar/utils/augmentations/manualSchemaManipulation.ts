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

const enumType = 'Indicator'
const phoneType = 'PhoneNumberType'
const countryType = 'RawCountryCodeText'
const stateType = 'RawStateCodeText'
const emailType = 'ElectronicAddressType'
export function agumentUiSchema(jsonSchema: any) {
  if (!jsonSchema) {
    return
  }
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
