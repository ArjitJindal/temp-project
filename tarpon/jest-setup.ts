import { exec, execSync } from 'child_process'
import { mockClient } from 'aws-sdk-client-mock'
import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager'
import axios from 'axios'
import { TEST_DYNAMODB_TABLE_NAMES } from './src/test-utils/dynamodb-test-utils'
import { mockedCurrencyExchangeRates as MOCKED_CURRENCY_EXCHANGE_RATES } from './test-resources/mocked-currency-exchange-rates'
import { CurrencyService } from '@/services/currency'
process.env.ENV = 'local'
if (!process.env.EXEC_SOURCE) {
  process.env.EXEC_SOURCE = 'LOCAL_TEST'
}

jest.mock('@lib/constants', () => ({
  StackConstants: {
    TARPON_DYNAMODB_TABLE_NAME: () => TEST_DYNAMODB_TABLE_NAMES[0],
    TARPON_RULE_DYNAMODB_TABLE_NAME: TEST_DYNAMODB_TABLE_NAMES[1],
    HAMMERHEAD_DYNAMODB_TABLE_NAME: () => TEST_DYNAMODB_TABLE_NAMES[2],
    TRANSIENT_DYNAMODB_TABLE_NAME: TEST_DYNAMODB_TABLE_NAMES[3],
  },
}))

jest
  .spyOn(CurrencyService.prototype, 'getExchangeData')
  .mockReturnValue(
    Promise.resolve(
      CurrencyService.parseCoinbaseResponse(MOCKED_CURRENCY_EXCHANGE_RATES)
    )
  )

if (process.env.ENABLE_SECRETS_MANAGER !== 'true') {
  mockClient(SecretsManagerClient)
    .on(GetSecretValueCommand)
    .resolves({ SecretString: 'fake' })
}

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
    }
  }
  try {
    await axios.post(
      'http://localhost:8123/?query=CREATE%20DATABASE%20IF%20NOT%20EXISTS%20tarpon_test'
    )
  } catch (e) {
    console.error((e as Error).message)
  }
}
