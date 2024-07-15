import { MerchantSummariser } from '@/services/merchant-monitoring/merchant-summariser'

describe('Merchant scrape', () => {
  const ms = new MerchantSummariser()
  test('Test result returned in correct JSON', async () => {
    const response = await ms.summarise(
      'SCRAPE',
      'Acme is a textile company which sells shoes in Delhi, India and generates a revenue of $100000 with 54 employees'
    )
    console.log(response)
  })
})
