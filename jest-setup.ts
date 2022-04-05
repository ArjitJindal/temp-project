import { execSync } from 'child_process'
import { exit } from 'process'

const TEST_DYNAMODB_TABLE_NAME = process.env.TEST_DYNAMODB_TABLE_NAME || 'test'

try {
  execSync(`npm run recreate-local-ddb --table=${TEST_DYNAMODB_TABLE_NAME}`)
} catch (e) {
  console.error(
    `Please start local dynamodb first by running 'npm run start-local-ddb'`
  )
  exit(1)
}

jest.mock('@cdk/constants', () => ({
  TarponStackConstants: {
    DYNAMODB_TABLE_NAME: TEST_DYNAMODB_TABLE_NAME,
  },
}))
