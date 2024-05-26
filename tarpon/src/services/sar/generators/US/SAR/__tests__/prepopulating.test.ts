import {
  address,
  addressByCardMerchantDetails,
} from '@/services/sar/generators/US/SAR/helpers/prepopulating'

describe('Prepopulating', () => {
  describe('Address prepopulation', () => {
    test('By address', async () => {
      expect(
        address({
          postcode: '77040',
          country: 'United States',
          addressLines: ['2098 Margaret Street'],
          state: 'Texas',
          city: 'Houston',
        })
      ).toEqual(
        expect.objectContaining({
          RawCityText: 'Houston',
          RawCountryCodeText: 'US',
          RawStateCodeText: 'TX',
          RawStreetAddress1Text: '2098 Margaret Street',
          RawZIPCode: '77040',
        })
      )
      expect(
        address({
          postcode: '77040',
          country: 'US',
          addressLines: ['2098 Margaret Street'],
          state: 'TX',
          city: 'Houston',
        })
      ).toEqual(
        expect.objectContaining({
          RawCityText: 'Houston',
          RawCountryCodeText: 'US',
          RawStateCodeText: 'TX',
          RawStreetAddress1Text: '2098 Margaret Street',
          RawZIPCode: '77040',
        })
      )
    })
    test('By card merchant details', async () => {
      expect(
        addressByCardMerchantDetails({
          postCode: '77040',
          country: 'US',
          state: 'Texas',
          city: 'Houston',
        })
      ).toEqual(
        expect.objectContaining({
          RawCityText: 'Houston',
          RawCountryCodeText: 'US',
          RawStateCodeText: 'TX',
          RawZIPCode: '77040',
        })
      )
      expect(
        addressByCardMerchantDetails({
          postCode: '77040',
          country: 'US',
          state: 'TX',
          city: 'Houston',
        })
      ).toEqual(
        expect.objectContaining({
          RawCityText: 'Houston',
          RawCountryCodeText: 'US',
          RawStateCodeText: 'TX',
          RawZIPCode: '77040',
        })
      )
    })
  })
})
