import { sampleBusinessUser } from '@/core/seed/samplers/users'
import { sampleTransaction } from '@/core/seed/samplers/transaction'
import {
  AttributeGenerator,
  DefaultAttributeBuilders,
} from '@/services/copilot/attributes/builder'

describe('Attribute generator', () => {
  test('Attributes are built correctly', async () => {
    const attributeGenerator = new AttributeGenerator(DefaultAttributeBuilders)
    const { user } = sampleBusinessUser({ country: 'AF' })
    const originUserId = user.userId
    const attributes = attributeGenerator.getAttributes({
      transactions: [
        sampleTransaction({ originUserId, destinationCountry: 'AF' }),
        sampleTransaction({ originUserId, destinationCountry: 'GB' }),
        sampleTransaction({ originUserId, destinationCountry: 'AF' }),
        sampleTransaction({ originUserId, destinationCountry: 'AF' }),
        sampleTransaction({ originUserId, destinationCountry: 'GB' }),
      ],
      user,
    })
    expect(attributes.getAttribute('debtorSameCountryAsUserCount')).toEqual(3)
    expect(attributes.getAttribute('distinctOriginUserCount')).toEqual(1)
    expect(attributes.size).toEqual(43)
  })
})
