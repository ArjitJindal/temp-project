import { generateJsonSchemaFromEntityClass } from '../json-schema'
import { ConsumerName } from '@/@types/openapi-public/ConsumerName'
import { NPPDetails } from '@/@types/openapi-public/NPPDetails'

describe('generateJsonSchemaFromEntityClass', () => {
  test('ConsumerName', async () => {
    const result = generateJsonSchemaFromEntityClass(ConsumerName)
    expect(result).toEqual({
      type: 'object',
      properties: {
        firstName: { type: 'string' },
        middleName: { type: 'string' },
        lastName: { type: 'string' },
      },
      required: ['firstName'],
    })
  })

  test('NPP Payment', async () => {
    const result = generateJsonSchemaFromEntityClass(NPPDetails)
    expect(result).toEqual({
      type: 'object',
      properties: {
        method: {
          type: 'string',
          enum: ['NPP'],
        },
        accountNumber: {
          type: 'string',
        },
        name: {
          type: 'object',
          properties: {
            firstName: {
              type: 'string',
            },
            middleName: {
              type: 'string',
            },
            lastName: {
              type: 'string',
            },
          },
          required: ['firstName'],
        },
        emailId: {
          type: 'string',
        },
        contactNumber: {
          type: 'string',
        },
        bsb: {
          type: 'string',
        },
        payId: {
          type: 'string',
        },
        endToEndId: {
          type: 'string',
        },
        oskoReference: {
          type: 'string',
        },
        payIdReference: {
          type: 'string',
        },
        isInstant: {
          type: 'boolean',
        },
        remittanceInformation: {
          type: 'string',
        },
        remittanceAdvice: {
          type: 'string',
        },
        tags: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              key: {
                type: 'string',
              },
              value: {
                type: 'string',
              },
              isTimestamp: {
                type: 'boolean',
              },
            },
            required: ['key', 'value'],
          },
        },
        processingDate: {
          type: 'number',
        },
        settlementDate: {
          type: 'number',
        },
        referenceNumber: {
          type: 'string',
        },
        traceNumber: {
          type: 'string',
        },
        messageFormat: {
          type: 'string',
        },
        bankName: {
          type: 'string',
        },
        address: {
          type: 'object',
          properties: {
            addressLines: {
              type: 'array',
              items: {
                type: 'string',
              },
            },
            postcode: {
              type: 'string',
            },
            city: {
              type: 'string',
            },
            state: {
              type: 'string',
            },
            country: {
              type: 'string',
            },
            addressType: {
              type: 'string',
            },
            tags: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  key: {
                    type: 'string',
                  },
                  value: {
                    type: 'string',
                  },
                  isTimestamp: {
                    type: 'boolean',
                  },
                },
                required: ['key', 'value'],
              },
            },
          },
          required: ['addressLines'],
        },
      },
      required: ['method'],
    })
  })
})
