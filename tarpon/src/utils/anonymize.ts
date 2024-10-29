import { faker } from '@faker-js/faker'
import { WithId } from 'mongodb'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { PaymentDetails } from '@/@types/tranasction/payment-type'
import { CaseCaseUsers } from '@/@types/openapi-internal/CaseCaseUsers'
import { InternalUser } from '@/@types/openapi-internal/InternalUser'
import { Case } from '@/@types/openapi-internal/Case'
import { AuditLog } from '@/@types/openapi-internal/AuditLog'
import { Account } from '@/@types/openapi-internal/Account'
import { ConsumerUserEvent } from '@/@types/openapi-public/ConsumerUserEvent'
import { BusinessUserEvent } from '@/@types/openapi-public/BusinessUserEvent'
import { TransactionEvent } from '@/@types/openapi-internal/TransactionEvent'
import { Transaction } from '@/@types/openapi-internal/Transaction'
import { CurrencyCode } from '@/@types/openapi-internal/CurrencyCode'
import { Person } from '@/@types/openapi-internal/Person'
import { Address } from '@/@types/openapi-internal/Address'
import { Tag } from '@/@types/openapi-internal/Tag'
import { ConsumerName } from '@/@types/openapi-internal/ConsumerName'
import { CountryCode } from '@/@types/openapi-internal/CountryCode'
import { LegalDocument } from '@/@types/openapi-internal/LegalDocument'
import { ContactDetails } from '@/@types/openapi-internal/ContactDetails'
import { TransactionAmountDetails } from '@/@types/openapi-internal/TransactionAmountDetails'
import { Amount } from '@/@types/openapi-internal/Amount'

export function anonymize<
  T extends WithId<
    | AuditLog
    | Case
    | TransactionEvent
    | Transaction
    | ConsumerUserEvent
    | BusinessUserEvent
    | Account
  >
>(collection: string, document: T): T {
  if (!document) {
    return document
  }

  let anonymizer: any
  switch (collection) {
    case 'auditlog':
      anonymizer = auditLog
      break
    case 'cases':
      anonymizer = caseCase
      break
    case 'transactions':
      anonymizer = transactions
      break
    case 'transaction-events':
      anonymizer = transactionEvents
      break
    case 'users':
      anonymizer = users
      break
    case 'user-events':
      anonymizer = userEvent
      break
    default:
      return document
  }

  return anonymizeDocument(anonymizer, document)
}

function anonymizeDocument(anonymizer: any, input: any): any {
  if (!input) {
    return
  }

  if (typeof anonymizer == 'string') {
    if (anonymized.has(input)) {
      return anonymized.get(input)
    }
    const [_one, two, three] = anonymizer.split('.')
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const output = faker[two][three]()
    anonymized.set(input, output)
    return output
  }
  const document = { ...input }
  for (const property in anonymizer) {
    if (Array.isArray(document[property])) {
      document[property] = document[property].map((element: any) =>
        anonymizeDocument(anonymizer[property][0], element)
      )
    } else {
      document[property] = anonymizeDocument(
        anonymizer[property],
        document[property]
      )
    }
  }
  return document
}

// Anonymizer mappings
type RecursivePartial<T> = {
  [P in keyof T]?: RecursivePartial<T[P]>
}

const tag: Tag = { key: 'faker.random.word', value: 'faker.random.word' }

const name: ConsumerName = {
  firstName: 'faker.random.word',
  middleName: 'faker.random.word',
  lastName: 'faker.random.word',
}

const legalDocument: Partial<LegalDocument> = {
  nameOnDocument: name,
  documentNumber: 'faker.random.word',
  tags: [tag],
}

const addressLines: Array<any> = ['faker.random.word']

const address: RecursivePartial<Address> = {
  postcode: 'faker.random.word',
  city: 'faker.random.word',
  country: 'faker.random.word',
  state: 'faker.random.word',
  tags: [tag],
  addressLines,
}

const contactDetails: RecursivePartial<ContactDetails> = {
  contactNumbers: ['faker.random.word'],
  faxNumbers: ['faker.random.word'],
  websites: ['faker.random.word'],
  addresses: [address],
}

const person: RecursivePartial<Person> = {
  generalDetails: {
    name: name,
    dateOfBirth: 'faker.random.word',
    countryOfResidence: 'faker.address.countryCode' as CountryCode,
    countryOfNationality: 'faker.address.countryCode' as CountryCode,
  },
  legalDocuments: [legalDocument],
  contactDetails,
  tags: [tag],
}

const amount: Partial<Amount> = {
  amountCurrency: 'faker.finance.currencyCode' as CurrencyCode,
}

const users: RecursivePartial<InternalUser> = {
  legalEntity: {
    contactDetails: contactDetails,
    companyFinancialDetails: {
      expectedTransactionAmountPerMonth: amount,
      expectedTurnoverPerMonth: amount,
      tags: [tag],
    },
    companyRegistrationDetails: {
      taxIdentifier: 'faker.random.word',
      registrationIdentifier: 'faker.random.word',
      legalEntityType: 'faker.random.word',
      registrationCountry: 'faker.address.countryCode' as CountryCode,
      tags: [tag],
    },
    companyGeneralDetails: {
      legalName: 'faker.random.word',
      tags: [tag],
    },
  },
  legalDocuments: [legalDocument],
  shareHolders: [person],
  directors: [person],
  tags: [tag],
  userDetails: {
    countryOfNationality: 'faker.address.countryCode' as CountryCode,
    countryOfResidence: 'faker.address.countryCode' as CountryCode,
    name: name,
  },
}

type LegacyPaymentDetailsFields = { bankId: string }

const paymentDetails: RecursivePartial<
  PaymentDetails & LegacyPaymentDetailsFields
> = {
  bankId: 'faker.random.word',
  accountNumber: 'faker.finance.iban',
  name: 'faker.random.word',
  beneficiaryName: 'faker.random.word',
  specialInstructions: 'faker.random.word',
  checkIdentifier: 'faker.random.word',
  swiftCode: 'faker.finance.iban',
  IBAN: 'faker.finance.iban',
  walletId: 'faker.random.word',
  walletPhoneNumber: 'faker.random.word',
  phoneNumber: 'faker.random.word',
  tags: [tag],
  transactionReferenceField: 'faker.random.word',
  nameOnCard: name,
  cardLast4Digits: '1234',
  shippingAddress: address,
}

const amountDetails: Partial<TransactionAmountDetails> = {
  country: 'faker.address.countryCode' as CountryCode,
  transactionCurrency: 'faker.finance.currencyCode' as CurrencyCode,
}

const transactionEvents: RecursivePartial<TransactionEvent> = {
  updatedTransactionAttributes: {
    originAmountDetails: amountDetails,
    destinationAmountDetails: amountDetails,
    originPaymentDetails: paymentDetails,
    destinationPaymentDetails: paymentDetails,
    reference: 'faker.random.word',
    tags: [tag],
  },
}

const transactions: RecursivePartial<InternalTransaction> = {
  reference: 'faker.random.word',
  destinationPaymentDetails: paymentDetails,
  originPaymentDetails: paymentDetails,
  originAmountDetails: amountDetails,
  destinationAmountDetails: amountDetails,
  originUser: users,
  destinationUser: users,
  tags: [tag],
}

const caseUsers: RecursivePartial<CaseCaseUsers> = {
  origin: users,
  destination: users,
}

const account: RecursivePartial<Account> = {
  email: 'faker.internet.email',
}

const auditLog: RecursivePartial<AuditLog> = {
  user: account,
}

const caseCase: RecursivePartial<Case> = {
  caseUsers,
}

const userEvent: RecursivePartial<ConsumerUserEvent | BusinessUserEvent> = {
  updatedBusinessUserAttributes: users,
  updatedConsumerUserAttributes: users,
}

const anonymized = new Map<string, string>()
