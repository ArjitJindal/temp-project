import AWS from '../api-key-generator/node_modules/aws-sdk'
import { v4 as uuidv4 } from 'uuid'
import {
  uniqueNamesGenerator,
  Config as namesConfig,
  names,
} from 'unique-names-generator'

import { IBAN, BIC } from 'ibankit'

/*
FIXME: USE TYPESCRIPT TYPES Generated from OPENAPI plx
*/

const getRandomIntInclusive = (min: number, max: number) => {
  min = Math.ceil(min)
  max = Math.floor(max)
  return Math.floor(Math.random() * (max - min + 1)) + min //The maximum is inclusive and the minimum is inclusive
}

const currencies: string[] = [
  'USD',
  'EUR',
  'JPY',
  'GBP',
  'INR',
  'NTD',
  'RUB',
  'SGD',
  'TRY',
]

const countries: string[] = [
  'US',
  'DE',
  'JP',
  'GB',
  'IN',
  'TW',
  'RU',
  'SG',
  'TR',
]

function createUuid() {
  return uuidv4().replace(/-/g, '')
}

const uniqueNamesConfig: namesConfig = {
  dictionaries: [names],
  length: 1,
}

const paymentMethods = ['CARD', 'BANK']

const createCardPaymentDetails = (sendingCountry: string, name: Object) => {
  return {
    cardFingerprint: createUuid().substring(0, 10),
    cardIssuedCountry: sendingCountry,
    nameOnCard: name,
  }
}

const createUserIds = (n: number) => {
  let userIDs: string[] = []
  for (let i = 0; i < n; i++) {
    userIDs.push(createUuid())
  }
  return userIDs
}

const productTypes = ['WALLET', 'REMITTANCE', 'BNPL']

/* FIXME: Update bank details once API changes (only EU countries have IBAN) */
const createBankPaymentDetails = (name: Object) => {
  const ibanInfo = IBAN.random()
  return {
    method: 'BANK',
    BIC: 'DEUTDEFF',
    bankName: `${uniqueNamesGenerator(uniqueNamesConfig)} Bank`,
    IBAN: ibanInfo.getAccountNumber(),
    name: name,
    bankBranchCode: ibanInfo.getBankCode(),
  }
}

const createPaymentDetails = (sendingCountry: string, name: Object) => {
  const paymentMethod = paymentMethods[getRandomIntInclusive(0, 1)]
  const paymentDeets =
    paymentMethod == 'CARD'
      ? createCardPaymentDetails(sendingCountry, name)
      : createBankPaymentDetails(name)
  return {
    method: paymentMethod,
    ...paymentDeets,
  }
}

export const createTransactionData = () => {
  const globalNumberOfUsers = 20
  let transactionObject
  const nameOne = {
    firstName: uniqueNamesGenerator(uniqueNamesConfig),
    middleName: uniqueNamesGenerator(uniqueNamesConfig),
    lastName: uniqueNamesGenerator(uniqueNamesConfig),
  }
  const nameTwo = {
    firstName: uniqueNamesGenerator(uniqueNamesConfig),
    middleName: uniqueNamesGenerator(uniqueNamesConfig),
    lastName: uniqueNamesGenerator(uniqueNamesConfig),
  }
  const countryCurrencyIndexOne = getRandomIntInclusive(0, 8)
  const countryOne = countries[countryCurrencyIndexOne]
  const currencyOne = currencies[countryCurrencyIndexOne]
  const countryCurrencyIndexTwo = getRandomIntInclusive(0, 8)
  const countryTwo = countries[countryCurrencyIndexTwo]
  const currencyTwo = currencies[countryCurrencyIndexTwo]

  const userIds: string[] = createUserIds(globalNumberOfUsers)

  for (let i = 0; i < 1; i++) {
    transactionObject = {
      senderUserId: userIds[getRandomIntInclusive(0, globalNumberOfUsers)],
      receiverUserId: userIds[getRandomIntInclusive(0, globalNumberOfUsers)],
      timestamp:
        Math.floor(Date.now() / 1000) - getRandomIntInclusive(1, 10000),
      sendingAmountDetails: {
        transactionAmount: getRandomIntInclusive(1, 10000),
        transactionCurrency: currencyOne,
        country: countryOne,
      },
      receivingAmountDetails: {
        transactionAmount: getRandomIntInclusive(1, 10000),
        transactionCurrency: currencyTwo,
        country: countryTwo,
      },
      senderPaymentDetails: createPaymentDetails(countryOne, nameOne),
      receiverPaymentDetails: createPaymentDetails(countryTwo, nameTwo),
      productType: productTypes[getRandomIntInclusive(0, 3)],
      promotionCodeUsed: getRandomIntInclusive(0, 10) > 8 ? true : false,
    }
    console.log(transactionObject)
  }
}
