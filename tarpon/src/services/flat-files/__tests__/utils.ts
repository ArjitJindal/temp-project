import { shortId } from '@flagright/lib/utils'
import { FlatFileSchema } from '@/@types/openapi-internal/FlatFileSchema'
import { FlatFilesService } from '@/services/flat-files'

const getRow = (data: object): Record<string, string> => {
  const result: Record<string, string> = {}

  const flattenObject = (obj: object, prefix: string = ''): void => {
    if (obj === null || obj === undefined) {
      return
    }

    if (typeof obj === 'object' && !Array.isArray(obj)) {
      // Handle regular objects
      for (const [key, value] of Object.entries(obj)) {
        const newPrefix = prefix ? `${prefix}.${key}` : key
        flattenObject(value, newPrefix)
      }
    } else if (Array.isArray(obj)) {
      // Handle arrays
      if (obj.length === 0) {
        // Empty array
        result[prefix] = ''
      } else {
        // Array of any type - flatten each item with index
        obj.forEach((item, index) => {
          const newPrefix = `${prefix}.${index}`
          if (typeof item === 'object' && item !== null) {
            // Array of objects - recursively flatten
            flattenObject(item, newPrefix)
          } else {
            // Array of primitives - create indexed key
            result[newPrefix] = String(item)
          }
        })
      }
    } else {
      // Primitive value
      result[prefix] = String(obj)
    }
  }

  flattenObject(data)
  return result
}

export const getCSVFormattedRow = async (
  data: object,
  service: FlatFilesService,
  schema: FlatFileSchema,
  metadata?: object
) => {
  const row = getRow(data)
  const header = await service.generateTemplate(schema, 'CSV', metadata)
  const formattedRow: string[] = []

  header.keys.forEach((key) => {
    if (row[key]) {
      formattedRow.push(row[key])
    } else {
      formattedRow.push('')
    }
  })

  return formattedRow.join(',')
}

export const mockConsumerUser = () => ({
  userId: shortId(),
  createdTimestamp: Date.now(),
  userDetails: {
    name: {
      firstName: 'Baran',
      middleName: 'Realblood',
      lastName: 'Ozkan',
    },
    dateOfBirth: '1991-01-01',
    countryOfResidence: 'US',
    countryOfNationality: 'DE',
  },

  legalDocuments: [
    {
      documentType: 'passport',
      documentNumber: 'Z9431P',
      documentIssuedDate: 1639939034000,
      documentExpirationDate: 1839939034000,
      documentIssuedCountry: 'DE',
      tags: [
        {
          key: 'customerType',
          value: 'wallet',
        },
      ],
    },
  ],
  contactDetails: {
    emailIds: ['baran@flagright.com'],
    contactNumbers: ['37112345432'],
    websites: ['flagright.com'],
    addresses: [
      {
        addressLines: ['Klara-Franke Str 20'],
        postcode: '10557',
        city: 'Berlin',
        state: 'Berlin',
        country: 'Germany',
        tags: [
          {
            key: 'customKey',
            value: 'customValue',
          },
        ],
      },
    ],
  },
  tags: [
    {
      key: 'customKey',
      value: 'customValue',
    },
  ],
})

export const mockBusinessUser = () => ({
  userId: shortId(),
  createdTimestamp: Date.now(),
  legalEntity: {
    companyGeneralDetails: {
      legalName: 'Ozkan Hazelnut Export JSC',
      businessIndustry: ['Farming'],
      mainProductsServicesSold: ['Hazelnut'],
    },
  },
})

export const mockTransaction = (
  originUserId: string,
  destinationUserId: string
) => ({
  transactionId: shortId(),
  timestamp: Date.now(),
  type: 'DEPOSIT',
  originUserId,
  destinationUserId,
  originAmountDetails: {
    transactionAmount: 800,
    transactionCurrency: 'EUR',
    country: 'DE',
  },
  destinationAmountDetails: {
    transactionAmount: 68351.34,
    transactionCurrency: 'INR',
    country: 'IN',
  },
  promotionCodeUsed: true,
  reference: 'loan repayment',
  originDeviceData: {
    batteryLevel: 95,
    deviceLatitude: 13.0033,
    deviceLongitude: 76.1004,
    ipAddress: '10.23.191.2',
    deviceIdentifier: '3c49f915d04485e34caba',
    vpnUsed: false,
    operatingSystem: 'Android 11.2',
    deviceMaker: 'ASUS',
    deviceModel: 'Zenphone M2 Pro Max',
    deviceYear: '2018',
    appVersion: '1.1.0',
  },
  destinationDeviceData: {
    batteryLevel: 95,
    deviceLatitude: 13.0033,
    deviceLongitude: 76.1004,
    ipAddress: '10.23.191.2',
    deviceIdentifier: '3c49f915d04485e34caba',
    vpnUsed: false,
    operatingSystem: 'Android 11.2',
    deviceMaker: 'ASUS',
    deviceModel: 'Zenphone M2 Pro Max',
    deviceYear: '2018',
    appVersion: '1.1.0',
  },
  tags: [
    {
      key: 'customKey',
      value: 'customValue',
    },
  ],
})
