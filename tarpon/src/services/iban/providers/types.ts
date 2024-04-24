import { IBANBankInfo } from '../types'

export interface ApiProvider {
  source: string
  enabled(): boolean
  cacheable(): boolean
  resolveIban(iban: string): Promise<{
    response: IBANBankInfo
    rawResponse: object
  }>
}
