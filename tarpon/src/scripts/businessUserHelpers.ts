import {
  createUuid,
  getRandomIntInclusive,
  getNameString,
  createNameEntity,
  generateRandomString,
} from './utils'
import {
  countries,
  businessIndustries,
  businessIndustryMainProducts,
  documentTypes,
} from './constants'
import { CountryCode } from '@/@types/openapi-public/CountryCode'
import { CurrencyCode } from '@/@types/openapi-public/CurrencyCode'

const createCompanyFinanceDetails = (currency: CurrencyCode) => {
  return {
    expectedTransactionAmountPerMonth: {
      amountValue: getRandomIntInclusive(1, 25000),
      amountCurrency: currency,
    },
    expectedTurnoverAmountPerMonth: {
      amountValue: getRandomIntInclusive(1, 100000),
      amountCurrency: currency,
    },
  }
}

const createCompanyRegistrationDetails = (country: CountryCode) => {
  return {
    registrationIdentifier: createUuid().slice(0, 10),
    registrationCountry: country,
  }
}

export const createLegalEntity = (
  currency: CurrencyCode,
  country: CountryCode
) => {
  const businessIndustry =
    businessIndustries[getRandomIntInclusive(0, businessIndustries.length - 1)]
  return {
    companyGeneralDetails: {
      legalName: `${getNameString()} Company JSC`,
      businessIndustry: [businessIndustry],
      mainProductsServicesSold: businessIndustryMainProducts[businessIndustry],
    },
    companyFinancialDetails: createCompanyFinanceDetails(currency),
    companyRegistrationDetails: createCompanyRegistrationDetails(country),
  }
}

export const createShareHolders = (country: CountryCode) => {
  const numberOfShareHolders = getRandomIntInclusive(0, 7)
  const shareHolders: any[] = []
  for (let i = 0; i < numberOfShareHolders; i++) {
    const shareHolder = {
      generalDetails: {
        name: createNameEntity(),
        age: getRandomIntInclusive(18, 80),
        countryOfResidence: country,
        countryOfNationality:
          countries[getRandomIntInclusive(0, country.length - 1)],
      },
      legalDocuments: [createLegalDocuments()],
    }
    shareHolders.push(shareHolder)
  }
  return shareHolders
}

const createLegalDocuments = () => {
  return {
    documentType:
      documentTypes[getRandomIntInclusive(0, documentTypes.length - 1)],
    documentNumber: generateRandomString(getRandomIntInclusive(8, 14)),
    documentIssuedCountry:
      countries[getRandomIntInclusive(8, countries.length - 1)],
  }
}
