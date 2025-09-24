import {
  getAddressStringForAggregation,
  parseAddressStringForAggregation,
} from '../helpers'
import { Address } from '@/@types/openapi-public/Address'

describe('Address aggregation helpers', () => {
  it('should serialize and parse back a full address correctly', () => {
    const address: Address = {
      addressLines: ['123 Main St', 'Apt 4B'],
      city: 'New York',
      state: 'NY',
      postcode: '10001',
      country: 'USA',
    }

    const serialized = getAddressStringForAggregation(address)
    const parsed = parseAddressStringForAggregation(serialized)

    expect(parsed).toEqual(address)
  })

  it('should handle missing fields gracefully', () => {
    const address: Address = {
      addressLines: ['123 Main St', 'Apt 4B'],
      city: 'Berlin',
    }

    const serialized = getAddressStringForAggregation(address)
    const parsed = parseAddressStringForAggregation(serialized)

    expect(parsed).toEqual({
      addressLines: ['123 Main St', 'Apt 4B'],
      city: 'Berlin',
      state: '',
      postcode: '',
      country: '',
    })
  })

  it('should return empty string when serializing undefined address', () => {
    const serialized = getAddressStringForAggregation(undefined)
    expect(serialized).toBe('')
  })

  it('should return empty object when parsing empty string', () => {
    const parsed = parseAddressStringForAggregation('')
    expect(parsed).toEqual(undefined)
  })

  it('should correctly escape special characters in values', () => {
    const address: Address = {
      addressLines: ['Line with | pipe', 'Line with = equal'],
      city: 'Paris|City=Test',
      state: 'Île-de-France',
      postcode: '75000',
      country: 'FR',
    }

    const serialized = getAddressStringForAggregation(address)
    const parsed = parseAddressStringForAggregation(serialized)

    expect(parsed).toEqual(address)
  })

  it('should work with only addressLines', () => {
    const address: Address = {
      addressLines: ['Only line'],
    }

    const serialized = getAddressStringForAggregation(address)
    const parsed = parseAddressStringForAggregation(serialized)

    expect(parsed).toEqual({
      addressLines: ['Only line'],
      city: '',
      state: '',
      postcode: '',
      country: '',
    })
  })

  it('should be reversible for random data (round-trip property)', () => {
    const address: Address = {
      addressLines: ['A', 'B', 'C'],
      city: 'X',
      state: 'Y',
      postcode: '123=456',
      country: 'C|D',
    }

    const serialized = getAddressStringForAggregation(address)
    const parsed = parseAddressStringForAggregation(serialized)

    expect(parsed).toEqual(address)
  })
})
