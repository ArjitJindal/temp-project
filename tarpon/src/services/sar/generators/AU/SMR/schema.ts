import cloneDeep from 'lodash/cloneDeep'
import merge from 'lodash/merge'
import omit from 'lodash/omit'
import pick from 'lodash/pick'
import { AustracJsonSchema } from './resources/SMRSchema'

function pickResolvedEntityFields(
  entityName: string,
  fields: string[],
  requiredFields: string[],
  overrides: object = {}
) {
  try {
    const required =
      requiredFields.length > 0
        ? requiredFields
        : AustracJsonSchema.definitions[entityName].required
        ? AustracJsonSchema.definitions[entityName].required
        : []
    let properties: Record<string, any> = AustracJsonSchema.definitions[
      entityName
    ].properties
      ? AustracJsonSchema.definitions[entityName].properties
      : {}

    AustracJsonSchema.definitions[entityName].allOf?.forEach((value: any) => {
      if (value.properties) {
        properties = merge(properties, value.properties)
      }
    })

    const picked =
      fields.length > 0
        ? cloneDeep(pick(properties, fields))
        : cloneDeep(properties)
    const result: Record<string, any> = {}

    for (const [key, overrideValue] of Object.entries(overrides)) {
      if (picked[key]) {
        const original = picked[key]
        const merged = merge({}, original)

        Object.keys(overrideValue).forEach((key) => {
          if (key !== 'properties') {
            merged[key] = merge(merge[key], overrideValue[key])
          }
        })

        // Deep merge override subfields into `properties`
        if (overrideValue.properties) {
          merged.properties = merged.properties || {}

          // Ordered insertion: put override keys first
          const mergedProperties: Record<string, any> = {}
          for (const [innerKey, innerOverride] of Object.entries(
            overrideValue.properties
          )) {
            const existing = merged.properties[innerKey] || {}
            mergedProperties[innerKey] = merge({}, existing, innerOverride)
          }

          // Add any remaining original fields not in override
          const remainingInner = omit(
            merged.properties,
            Object.keys(overrideValue.properties)
          )
          Object.assign(mergedProperties, remainingInner)

          merged.properties = mergedProperties
        }

        // Merge other root-level values (like `title`, `required`)
        result[key] = merge({}, merged, omit(overrideValue, ['properties']))
      } else {
        // If field didn't exist in base schema, just insert override
        result[key] = overrideValue
      }
    }

    // Append remaining picked fields (not in overrides)
    const remaining = omit(picked, Object.keys(overrides))
    Object.assign(result, remaining)
    return {
      type: 'object',
      properties: result,
      required: required,
    }
  } catch (e) {
    console.error(entityName, e)
  }
}

export const DetailsOfSuspiciousMatter = {
  type: 'object',
  title: 'PART A - Details of the matter',
  description:
    'The purpose of Part A is to record the type of designated service(s) to which the suspicious matter relates and the reason why the suspicion was formed.',
  'ui:schema': {
    'ui:group': 'PART A',
  },
  ...pickResolvedEntityFields(
    'smDetails',
    [],
    ['designatedSvc', 'suspReason', 'grandTotal']
  ),
}

export const GroundsForSuspicion = {
  type: 'object',
  title: 'PART B - Grounds for suspicion',
  'ui:schema': {
    'ui:group': 'PART B',
  },
  description:
    'The purpose of Part B is to record the grounds for suspicion and the reasons why the suspicion was formed.',
  ...pickResolvedEntityFields('suspGrounds', [], []),
}

export const DetailsOfPerson = {
  type: 'array',
  title:
    'PART C - Details of the person/organisation to which the suspicious matter relates',
  'ui:schema': {
    'ui:group': 'PART C',
  },
  description:
    'The purpose of Part C is to record details on the person or organisation to which the suspicious matter relates.',
  items: {
    properties: {
      person: {
        ...pickResolvedEntityFields('suspPerson', [], []),
        title: 'Detail of the person/organisation ',
      },
    },
    type: 'object',
  },
}

export const DetailsOfOtherParty = {
  type: 'array',
  title:
    'PART D - Details of any other party to which the suspicious matter relates',
  description:
    'The purpose of Part D is to record details of any other party involved in the suspicious matter.',
  'ui:schema': {
    'ui:group': 'PART D',
  },
  items: {
    properties: {
      otherParty: {
        ...pickResolvedEntityFields('otherPerson', [], []),
        title: 'Detail of the other party',
      },
    },
    type: 'object',
  },
}

export const DetailsOfUnidentifiedPerson = {
  type: 'array',
  title:
    'PART E - Suspicious person(s) whose identity could not be established',
  description:
    'The purpose of Part E is to describe any person(s) whose identity could not be established and describe any documentation held on the person. ',
  'ui:schema': {
    'ui:group': 'PART E',
  },
  items: {
    properties: {
      unidentifiedPerson: {
        ...pickResolvedEntityFields('unidentPerson', [], []),
        title: 'Detail of the unidentified person',
      },
    },
    type: 'object',
  },
}

export const TransactionsRelatedToMatter = {
  type: 'array',
  title: 'PART F - Transactions related to the matter ',
  description:
    'The purpose of Part F is to report the transactions related to the suspicious matter and the parties involved',
  'ui:schema': {
    'ui:group': 'PART F',
  },
  items: {
    properties: {
      transaction: {
        ...pickResolvedEntityFields('txnDetail', [], []),
        title: 'Detail of the transaction',
      },
    },
    type: 'object',
  },
}

export const AdditionalDetails = {
  type: 'object',
  title: 'PART G - Additional details',
  description:
    'The purpose of Part G is to outline the most likely offence that the matter relates to and to indicate any other associated reports.',
  'ui:schema': {
    'ui:group': 'PART G',
  },
  ...pickResolvedEntityFields('additionalDetails', [], []),
}

const reportingEntity = pickResolvedEntityFields('BranchOptAddr', [], [])

export const ReportingEntity = {
  type: 'object',
  title: 'PART H - Reporting entity',
  description:
    'The purpose of Part H is to record the details of the reporting entity lodging the report.',
  'ui:schema': {
    'ui:group': 'PART H',
  },
  properties: {
    fileName: {
      title: 'Report name',
      description:
        'The name of an SMR report file, where “SMRyyyymmddss” includes the date it was created (yyyymmdd) and “ss” is a two-digit number indicating its sequence for that day. For example: “SMR2025081501”',
      type: 'string',
      pattern:
        '^SMR(19|20)\\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\\d|3[01])(0[1-9]|[1-9]\\d)$',
    },
    reNumber: {
      title: 'Reporting entity number',
      description:
        'Reporting entity number – this is the unique number allocated to each reporting entity as they enrol or register with AUSTRAC.',
      type: 'string',
      pattern: '[0-9]{1,7}',
    },
    reReportRef: {
      title: 'Reporting entity reference number',
      description:
        'The reporting entity’s unique reference number in relation to this suspicious matter report, if any.',
      type: 'string',
    },
    ...reportingEntity?.properties,
  },
  required: [...(reportingEntity?.required || []), 'reNumber', 'fileName'],
}
