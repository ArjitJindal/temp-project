import { TEST_DYNAMODB_TABLE_NAME } from './src/test-utils/dynamodb-test-utils'

jest.mock('@cdk/constants', () => ({
  StackConstants: {
    TARPON_DYNAMODB_TABLE_NAME: TEST_DYNAMODB_TABLE_NAME,
    HAMMERHEAD_DYNAMODB_TABLE_NAME: TEST_DYNAMODB_TABLE_NAME,
  },
}))
