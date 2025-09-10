import COUNTRIES from './countries'
import { CountryCode } from '@/@types/openapi-public/CountryCode'

type Address = {
  country?: CountryCode
  city?: string
  state?: string
  postcode?: string
  streetAddress?: string[]
}

interface FormatOptions {
  abbreviate?: boolean
}

export function formatAddress(
  address: Address,
  options: FormatOptions = {}
): string {
  const { abbreviate = false } = options

  const lines: string[] = []

  // 1. Street
  if (address.streetAddress) {
    lines.push(address.streetAddress.join(', '))
  }

  // 2. City + State + Postcode
  if (address.city || address.state || address.postcode) {
    let line = ''
    if (address.city) {
      line += address.city
    }

    if (address.state) {
      // Abbreviation example: only first 2 chars
      const stateFormatted = abbreviate
        ? address.state.slice(0, 2).toUpperCase()
        : address.state

      if (line) {
        line += ', '
      }
      line += stateFormatted
    }

    if (address.postcode) {
      line += (line ? ' ' : '') + address.postcode
    }

    lines.push(line)
  }

  // 3. Country (always last)
  if (address.country) {
    lines.push(COUNTRIES[address.country])
  }

  return lines.join('\n')
}
