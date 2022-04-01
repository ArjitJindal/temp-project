import { ConverterInterface } from '../converter-interface'
import { Business } from '@/@types/openapi-public/Business'

export const FlagrightBusinessConverter: ConverterInterface<Business> = {
  getCsvParserOptions() {
    return { headers: true }
  },
  validate(rawBusiness: any): string[] {
    return []
  },
  convert(rawBusiness: any): Business {
    // TODO: Implement
    return null as any
  },
}
