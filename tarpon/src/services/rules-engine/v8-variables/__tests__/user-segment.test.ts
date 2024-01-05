import { CONSUMER_USER_SEGMENT, BUSINESS_USER_SEGMENT } from '../user-segment'
import { getTestBusiness, getTestUser } from '@/test-utils/user-test-utils'

test('gets user segment from a consumer', async () => {
  const user = getTestUser({ userSegment: 'RETAIL' })
  const userSegment = await CONSUMER_USER_SEGMENT.load(user)
  expect(userSegment).toBe('RETAIL')
})

test('gets user segment from a business', async () => {
  const user = getTestBusiness({
    legalEntity: {
      companyGeneralDetails: {
        legalName: 'V8 Engines plc',
        userSegment: 'SMB',
      },
    },
  })
  const userSegment = await BUSINESS_USER_SEGMENT.load(user)
  expect(userSegment).toBe('SMB')
})
