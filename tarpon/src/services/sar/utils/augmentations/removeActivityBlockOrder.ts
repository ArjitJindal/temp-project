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
