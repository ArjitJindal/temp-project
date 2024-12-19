import { BusinessUserSampler } from '@/core/seed/samplers/users'
import { TransactionSampler } from '@/core/seed/samplers/transaction'
import {
  AttributeGenerator,
  DefaultAttributeBuilders,
} from '@/services/copilot/attributes/builder'

describe('Attribute generator', () => {
  test('Attributes are built correctly', async () => {
    const attributeGenerator = new AttributeGenerator(
      DefaultAttributeBuilders,
      []
    )
    const userSampler = new BusinessUserSampler(0)
    const transactionSamper = new TransactionSampler(0)

    const user = userSampler.getSample(undefined, { country: 'AF' })
    const originUserId = user.userId

    const attributes = await attributeGenerator.getAttributes({
      transactions: [
        transactionSamper.getSample(1, {
          originUserId,
          destinationCountry: 'AF',
        }),
        transactionSamper.getSample(1, {
          originUserId,
          destinationCountry: 'GB',
        }),
        transactionSamper.getSample(1, {
          originUserId,
          destinationCountry: 'AF',
        }),
        transactionSamper.getSample(1, {
          originUserId,
          destinationCountry: 'AF',
        }),
        transactionSamper.getSample(1, {
          originUserId,
          destinationCountry: 'GB',
        }),
      ],
      user,
      reasons: [],
    })
    expect(attributes.getAttribute('transactionsCount')).toEqual(5)
  })
})
