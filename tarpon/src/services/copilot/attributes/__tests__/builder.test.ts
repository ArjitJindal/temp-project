import { BusinessUserSampler } from '@/core/seed/samplers/users'
import { TransactionSampler } from '@/core/seed/samplers/transaction'
import {
  AttributeGenerator,
  DefaultAttributeBuilders,
} from '@/services/copilot/attributes/builder'
import { CurrencyService } from '@/services/currency'
import { setAccounts } from '@/core/seed/samplers/accounts'
import { Account } from '@/@types/openapi-internal/Account'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { getS3ClientByEvent } from '@/utils/s3'

describe('Attribute generator', () => {
  test('Attributes are built correctly', async () => {
    const attributeGenerator = new AttributeGenerator(
      DefaultAttributeBuilders,
      []
    )
    const s3 = getS3ClientByEvent(null as any)
    const userSampler = new BusinessUserSampler(0, s3)
    const transactionSamper = new TransactionSampler(0)

    // first need to populate the accounts with mock data
    setAccounts([
      {
        id: '1',
        name: 'test',
        email: 'test@test.com',
      } as Account,
    ])
    const user = await userSampler.getSample(undefined, 'test', false, 'AF')
    const originUserId = user.userId
    const dynamoDb = getDynamoDbClient()
    const currencyService = new CurrencyService(dynamoDb)

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
      exchangeRates: (await currencyService.getExchangeData()).rates,
    })
    expect(attributes.getAttribute('transactionsCount')).toEqual(5)
  })
})
