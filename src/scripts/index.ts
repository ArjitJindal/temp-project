import * as AWS from 'aws-sdk'
import { IBAN } from 'ibankit'

import { TransactionRepository } from '../lambdas/rules-engine/repositories/transaction-repository'
import { UserRepository } from '../lambdas/user-management/repositories/user-repository'
import {
  createUuid,
  getRandomIntInclusive,
  createNameEntity,
  getNameString,
} from './utils'
import { createLegalEntity, createShareHolders } from './businessUserHelpers'
import { countries, currencies, ruleInstances } from './constants'
import { TransactionWithRulesResult } from '../@types/openapi-public/TransactionWithRulesResult'

/*
FIXME: USE TYPESCRIPT TYPES Generated from OPENAPI plx
*/

const paymentMethods = ['CARD', 'IBAN']

const createCardPaymentDetails = (sendingCountry: string, name: any) => {
  return {
    cardFingerprint: createUuid().substring(0, 10),
    cardIssuedCountry: sendingCountry,
    nameOnCard: name,
  }
}

const createBusinessUsers = (
  dynamoDb: AWS.DynamoDB.DocumentClient,
  tenantId: string,
  numberOfUsers: number,
  currency: string,
  country: string
) => {
  const userIDs: string[] = []
  const userRepository = new UserRepository(`fake-${tenantId}`, {
    dynamoDb: dynamoDb,
  })
  for (let i = 0; i < numberOfUsers; i++) {
    const userId = createUuid()
    userIDs.push(userId)
    const userObject = {
      userId: userId,
      legalEntity: createLegalEntity(currency, country),
      shareHolders: createShareHolders(country),
      createdTimestamp:
        Math.floor(Date.now() / 1000) - getRandomIntInclusive(1, 10000),
    }

    userRepository.createBusinessUser(userObject)
    console.log(JSON.stringify(userObject))
  }
  return userIDs
}

const productTypes = ['WALLET', 'REMITTANCE', 'BNPL']

/* FIXME: Update bank details once API changes (only EU countries have IBAN) */
const createBankPaymentDetails = (name: any) => {
  const ibanInfo = IBAN.random()
  return {
    method: 'IBAN',
    BIC: 'DEUTDEFF',
    bankName: `${getNameString()} Bank`,
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

export const createAndUploadTestData = async (
  tenantId: string,
  numberOfUsers: number,
  numberOfTransactions: number,
  profileName: string
) => {
  /* DB init */
  const dynamoDb = new AWS.DynamoDB.DocumentClient({
    credentials: {
      accessKeyId: 'ASIA5IULRCLFPLT4ZOG7',
      secretAccessKey: 'PeCjt3Xf28M2tdaJACSEajPD0Jf0cWKGuaDHLfHq',
      sessionToken: 'IQoJb3JpZ2luX2VjEIT//////////wEaCXVzLWVhc3QtMiJGMEQCIG7V4LN3rl1egNMPaUmLBDiK6YbCc/vzTD+RgIcb2a8eAiBOPnUEjvWoHRR/npHCmCH+QeMyL4nRTNmmOj+5fTRUeiqPAwgdEAAaDDkxMTg5OTQzMTYyNiIMncOF2e2eS21p4EkQKuwCTtnvOhLBiThAN1LY/0qyUbOJYfkGa/1lQUjYS8g02W5jE7NOsyzHI3o+Euwj6PnUoAEZuiEJ4JgF3NuPcAhvZT7KTR/jWkBP01BnaLf5sGM5AVtFqHwUA3teEpO31BA5J+P6sUjedblBdXNpJV55yhaJLKkjjKHXOsDpGYeSzncKxwrHz3AYBcE22Ii17s+IBAefPBB1YuZ0eHR59KsIlH0xkxp3x/nSUV9dgo5yypVIEnwI8/C2OTlLK6p1J67iAU86UgT43931Af1+ADtp7JdmEAd/84gvDjBTzLHPDwaUHNUqLiRuzu2o1TU6AVy/fT1UCfgCELbQ7tRY7nA2AN4RpRmDfXsrQhAUi2QaPrVn6C4ph77NNqun7ID/B9lVBF93Qs//LlkeKONTS1Cv6LzPatUy+WKlnU6qOk1lnR4sLoYbLlSZG0dniRuYoBDzXLDk8Mu8y2nOf+ej2OYVPviK1kC6buCjFamdPjCFjJiSBjqnASOQjP6VxIK+Ew2K/T0e6E70wHNdp9PJpWhPllb3HtspCEHemc8YuOigSEa19rsCMxn91txwJxVtzN54bSWegCpfa89I6nKFeyNLKIERIJoOxSo1zJfASJS2hRtLahQ6qUjTvz1kWzHzG77gJhX/19AYWi6StX2bqzGAOhc/LvTE31xCu2hOnPoDvJyAkeABGP7aKAV9CIZJzD4h9+Yfi/ppXRAycJFJ'
    },
  })
  const transactionRepository = new TransactionRepository(`fake-${tenantId}`, {
    dynamoDb,
  })

  let transactionObject: TransactionWithRulesResult
  const nameOne = createNameEntity()
  const nameTwo = createNameEntity()
  const countryCurrencyIndexOne = getRandomIntInclusive(0, 8)
  const countryOne = countries[countryCurrencyIndexOne]
  const currencyOne = currencies[countryCurrencyIndexOne]
  const countryCurrencyIndexTwo = getRandomIntInclusive(0, 8)
  const countryTwo = countries[countryCurrencyIndexTwo]
  const currencyTwo = currencies[countryCurrencyIndexTwo]

  const userIds: string[] = createBusinessUsers(
    dynamoDb,
    tenantId,
    numberOfUsers,
    currencyOne,
    countryOne
  )

  const dynamoDbResults = []

  for (let i = 0; i < numberOfTransactions; i++) {
    transactionObject = {
      senderUserId: userIds[getRandomIntInclusive(0, numberOfUsers)],
      receiverUserId: userIds[getRandomIntInclusive(0, numberOfUsers)],
      timestamp:
        Math.floor(Date.now() / 1000) - getRandomIntInclusive(1, 300000),
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
      executedRules: ruleInstances,
      failedRules: []
    }
    const ddbSaveTransactionResult =
      await transactionRepository.saveTransaction(transactionObject)
    dynamoDbResults.push(ddbSaveTransactionResult)
  }
  return { body: dynamoDbResults }
}
