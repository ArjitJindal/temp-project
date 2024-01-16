import { USER_TYPE } from '../user-type'
import { getTestBusiness, getTestUser } from '@/test-utils/user-test-utils'

test('User type: consumer', async () => {
  const user = getTestUser({})
  const type = await USER_TYPE.load(user)
  expect(type).toBe('CONSUMER')
})

test('User type: business', async () => {
  const user = getTestBusiness({})
  const type = await USER_TYPE.load(user)
  expect(type).toBe('BUSINESS')
})
