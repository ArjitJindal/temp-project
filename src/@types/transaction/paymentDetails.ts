import { Address } from './address'
import { ConsumerName } from './consumerName'

export type PaymentMethod = 'BANK' | 'CARD'
export type PaymentDetails = { method: PaymentMethod } & (
  | CardDetails
  | BankDetails
)

export type CardDetails = {
  cardFingerprint: string
  cardIssuedCountry: string
  transactionReferenceField: string
  '3dsDone': string
  nameOnCard: ConsumerName
}

export type BankDetails = {
  bankIdentifierType: string
  bankIdentifier: string
  bankName: string
  bankAddress: Address
  name: ConsumerName
  accountNumber: string
  tags: { [key: string]: string }
}
