import * as AWS from 'aws-sdk'
import { IBAN } from 'ibankit'

import { TransactionWithRulesResult } from '../@types/openapi-public/TransactionWithRulesResult'
import {
  createUuid,
  getRandomIntInclusive,
  createNameEntity,
  getNameString,
} from './utils'
import { createLegalEntity, createShareHolders } from './businessUserHelpers'
import { countries, currencies, ruleInstances } from './constants'
import { UserRepository } from '@/services/users/repositories/user-repository'
import { TransactionRepository } from '@/services/rules-engine/repositories/transaction-repository'
import { CardPaymentMethod } from '@/@types/openapi-public/CardPaymentMethod'
import { IBANPaymentMethod } from '@/@types/openapi-public/IBANPaymentMethod'
import { logger } from '@/core/logger'

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

    userRepository.saveBusinessUser(userObject)
    logger.info(JSON.stringify(userObject))
  }
  return userIDs
}

const productTypes = ['WALLET', 'REMITTANCE', 'BNPL']

/* FIXME: Update bank details once API changes (only EU countries have IBAN) */
const createBankPaymentDetails = (name: any) => {
  const ibanInfo = IBAN.random()
  return {
    method: 'IBAN' as IBANPaymentMethod,
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
  if (paymentMethod == 'CARD') {
    return {
      method: 'CARD' as CardPaymentMethod,
      ...createCardPaymentDetails(sendingCountry, name),
    }
  } else {
    return createBankPaymentDetails(name)
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
    credentials: new AWS.SharedIniFileCredentials({
      profile: profileName,
    }),
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
      originUserId: userIds[getRandomIntInclusive(0, numberOfUsers)],
      destinationUserId: userIds[getRandomIntInclusive(0, numberOfUsers)],
      timestamp:
        Math.floor(Date.now() / 1000) - getRandomIntInclusive(1, 300000),
      originAmountDetails: {
        transactionAmount: getRandomIntInclusive(1, 10000),
        transactionCurrency: currencyOne,
        country: countryOne,
      },
      destinationAmountDetails: {
        transactionAmount: getRandomIntInclusive(1, 10000),
        transactionCurrency: currencyTwo,
        country: countryTwo,
      },
      originPaymentDetails: createPaymentDetails(countryOne, nameOne),
      destinationPaymentDetails: createPaymentDetails(countryTwo, nameTwo),
      productType: productTypes[getRandomIntInclusive(0, 3)],
      promotionCodeUsed: getRandomIntInclusive(0, 10) > 8 ? true : false,
      executedRules: ruleInstances,
      hitRules: [],
    }
    const ddbSaveTransactionResult =
      await transactionRepository.saveTransaction(transactionObject)
    dynamoDbResults.push(ddbSaveTransactionResult.transactionId)
  }
  return { body: dynamoDbResults }
}
