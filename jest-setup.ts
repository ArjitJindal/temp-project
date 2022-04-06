import { TEST_DYNAMODB_TABLE_NAME } from './src/test-utils/dynamodb-test-utils'

jest.mock('@cdk/constants', () => ({
  TarponStackConstants: {
    DYNAMODB_TABLE_NAME: TEST_DYNAMODB_TABLE_NAME,
  },
}))
