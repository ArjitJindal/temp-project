import { TEST_DYNAMODB_TABLE_NAME } from './src/test-utils/dynamodb-test-utils'

jest.mock('@cdk/constants', () => ({
  StackConstants: {
    TARPON_DYNAMODB_TABLE_NAME: TEST_DYNAMODB_TABLE_NAME,
    HAMMERHEAD_DYNAMODB_TABLE_NAME: TEST_DYNAMODB_TABLE_NAME,
    TRANSIENT_DYNAMODB_TABLE_NAME: TEST_DYNAMODB_TABLE_NAME,
  },
}))

process.env.RETRY_KINESIS_STREAM_NAME = 'mock-retry-stream'
process.env.DYNAMODB_URI = 'http://localhost:8000'
