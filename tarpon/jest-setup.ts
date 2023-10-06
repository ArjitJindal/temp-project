import { exec, execSync } from 'child_process'
import { TEST_DYNAMODB_TABLE_NAMES } from './src/test-utils/dynamodb-test-utils'
import MOCKED_CURRENCY_EXCHANGE_RATES from './test-resources/mocked-currency-exchange-rates.json'
import * as CurrencyUtils from './src/utils/currency-utils'
process.env.ENV = 'local'
process.env.DYNAMODB_URI = 'http://localhost:7999'
if (!process.env.EXEC_SOURCE) {
  process.env.EXEC_SOURCE = 'LOCAL_TEST'
}

jest.mock('@lib/constants', () => ({
  StackConstants: {
    TARPON_DYNAMODB_TABLE_NAME: TEST_DYNAMODB_TABLE_NAMES[0],
    TARPON_RULE_DYNAMODB_TABLE_NAME: TEST_DYNAMODB_TABLE_NAMES[1],
    HAMMERHEAD_DYNAMODB_TABLE_NAME: TEST_DYNAMODB_TABLE_NAMES[2],
    TRANSIENT_DYNAMODB_TABLE_NAME: TEST_DYNAMODB_TABLE_NAMES[3],
  },
}))

jest.mock('@/utils/currency-utils', () => {
  const originalModule = jest.requireActual('@/utils/currency-utils')
  return {
    ...originalModule,
    getCurrencyExchangeRate: jest.fn().mockImplementation((...args) => {
      const [sourceCurrency, targetCurrency] = args

      if (sourceCurrency === targetCurrency) {
        return 1
      }

      return MOCKED_CURRENCY_EXCHANGE_RATES[sourceCurrency][targetCurrency]
    }),
    getTargetCurrencyAmount: jest.fn().mockImplementation((...args) => {
      const [transactionAmountDefails, targetCurrency] = args
      const sourceCurrency = transactionAmountDefails.transactionCurrency

      if (sourceCurrency === targetCurrency) {
        return transactionAmountDefails
      }

      const rate =
        MOCKED_CURRENCY_EXCHANGE_RATES?.[sourceCurrency]?.[targetCurrency]

      if (rate == null) {
        throw new Error(
          `Mocked getCurrencyExchangeRate(${sourceCurrency}, ${targetCurrency}) is not implemented`
        )
      }

      return {
        transactionAmount: transactionAmountDefails.transactionAmount * rate,
        transactionCurrency: targetCurrency,
      }
    }),
  }
})

jest
  .spyOn(CurrencyUtils, 'getCurrencyExchangeRate')
  .mockImplementation(async (...args) => {
    const [sourceCurrency, targetCurrency] = args
    console.log(
      `Mocked getCurrencyExchangeRate(${sourceCurrency}, ${targetCurrency})`
    )
    return MOCKED_CURRENCY_EXCHANGE_RATES[sourceCurrency][targetCurrency]
  })

module.exports = async function () {
  if (process.env.EXEC_SOURCE !== 'CI') {
    const localDynamoDbTestPsOutput = execSync(
      'docker ps -f name=local-dynamodb-test',
      {
        encoding: 'utf8',
        stdio: [],
      }
    )
    if (!localDynamoDbTestPsOutput.includes('local-dynamodb-test')) {
      try {
        execSync('docker rm local-dynamodb-test', { stdio: [] })
      } catch (e) {
        //ignore
      }
      exec(
        'docker run --name local-dynamodb-test -p 7999:8000 amazon/dynamodb-local -jar DynamoDBLocal.jar -inMemory -sharedDb'
      )
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }
}
