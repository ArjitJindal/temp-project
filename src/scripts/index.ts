import * as AWS from 'aws-sdk'
import { v4 as uuidv4 } from 'uuid'
import {
  uniqueNamesGenerator,
  Config as namesConfig,
  names,
} from 'unique-names-generator'

import { IBAN } from 'ibankit'

import { TransactionRepository } from '../rules-engine/repositories/transaction-repository'

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

const createCardPaymentDetails = (sendingCountry: string, name: any) => {
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
const createBankPaymentDetails = (name: any) => {
  const ibanInfo = IBAN.random()
  return {
    method: 'BANK',
    BIC: 'DEUTDEFF',
    bankName: `${uniqueNamesGenerator(uniqueNamesConfig)} Bank`,
    IBAN: (ibanInfo.getAccountNumber() !== null
      ? ibanInfo.getAccountNumber()
      : 'DE9712243431123') as string,
    name: name,
    bankBranchCode: (ibanInfo.getBankCode() !== null
      ? ibanInfo.getBankCode()
      : '407') as string,
  }
}

const createPaymentDetails = (sendingCountry: string, name: any) => {
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

export const createTransactionData = async (
  tenantId: string,
  numberOfUsers: number,
  numberOfTransactions: number,
  profileName: string
) => {
  /* DB init */
  const dynamoDb = new AWS.DynamoDB.DocumentClient({
    credentials: new AWS.SharedIniFileCredentials({
      profile: profileName,
    }),
  })
  const transactionRepository = new TransactionRepository(
    `fake-${tenantId}`,
    dynamoDb
  )

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

  const userIds: string[] = createUserIds(numberOfUsers)

  const dynamoDbResults = []

  for (let i = 0; i < numberOfTransactions; i++) {
    transactionObject = {
      senderUserId: userIds[getRandomIntInclusive(0, numberOfUsers)],
      receiverUserId: userIds[getRandomIntInclusive(0, numberOfUsers)],
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
    let ddbSaveTransactionResult = await transactionRepository.saveTransaction(
      transactionObject
    )
    dynamoDbResults.push(ddbSaveTransactionResult)
  }
  return { body: dynamoDbResults }
}
