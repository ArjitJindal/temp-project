import {
  CONSUMER_USER_ACQUISITION_CHANNEL,
  BUSINESS_USER_ACQUISITION_CHANNEL,
} from '../user-acquisition-channel'
import { getTestBusiness, getTestUser } from '@/test-utils/user-test-utils'

test('gets user acquisition channel from a consumer', async () => {
  const user = getTestUser({ acquisitionChannel: 'ORGANIC' })
  const acquisitionChannel = await CONSUMER_USER_ACQUISITION_CHANNEL.load(user)
  expect(acquisitionChannel).toBe('ORGANIC')
})

test('gets user acquisition channel from a business', async () => {
  const user = getTestBusiness({ acquisitionChannel: 'UNKNOWN' })
  const acquisitionChannel = await BUSINESS_USER_ACQUISITION_CHANNEL.load(user)
  expect(acquisitionChannel).toBe('UNKNOWN')
})
