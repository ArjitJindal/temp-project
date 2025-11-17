import { humanizeAuto, humanizeConstant } from '@flagright/lib/utils/humanize'
import pluralize from 'pluralize'
import { COUNTRIES } from '@flagright/lib/constants/countries'
import { Case } from '@/@types/openapi-internal/Case'
import {
  Item,
  Report,
  Row,
  Section,
  Sheet,
  Table,
} from '@/services/cases/utils/xlsx-generator'
import { isSimpleValue, notEmpty } from '@/utils/array'
import { PaymentDetails } from '@/@types/tranasction/payment-type'
import { Address } from '@/@types/openapi-public/Address'
import { ContactDetails } from '@/@types/openapi-internal/ContactDetails'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { neverReturn } from '@/utils/lang'
import { Person } from '@/@types/openapi-internal/Person'
import { LegalDocument } from '@/@types/openapi-internal/LegalDocument'
import { PaymentMethod } from '@/@types/openapi-internal/PaymentMethod'
import { MissingUser } from '@/@types/openapi-internal/MissingUser'
import { formatConsumerName, getUserName, isPerson } from '@/utils/helpers'
import dayjs, { duration } from '@/utils/dayjs'
import { AccountsService } from '@/services/accounts'
import { MongoDbTransactionRepository } from '@/services/rules-engine/repositories/mongodb-transaction-repository'
import { CountryCode } from '@/@types/openapi-internal/CountryCode'
import { EntityGraph, LinkerService } from '@/services/linker'
import { TransactionAmountDetails } from '@/@types/openapi-internal/TransactionAmountDetails'
import { CardDetails } from '@/@types/openapi-internal/CardDetails'
import { GenericBankAccountDetails } from '@/@types/openapi-internal/GenericBankAccountDetails'
import { IBANDetails } from '@/@types/openapi-internal/IBANDetails'
import { ACHDetails } from '@/@types/openapi-internal/ACHDetails'
import { SWIFTDetails } from '@/@types/openapi-internal/SWIFTDetails'
import { MpesaDetails } from '@/@types/openapi-internal/MpesaDetails'
import { UPIDetails } from '@/@types/openapi-internal/UPIDetails'
import { WalletDetails } from '@/@types/openapi-internal/WalletDetails'
import { CheckDetails } from '@/@types/openapi-internal/CheckDetails'
import { CashDetails } from '@/@types/openapi-internal/CashDetails'
import { NPPDetails } from '@/@types/openapi-public/NPPDetails'
import { LegalEntity } from '@/@types/openapi-internal/LegalEntity'

interface ReportParams {
  afterTimestamp: number
  addUserDetails?: boolean
  addPaymentDetails?: boolean
  addAlertDetails?: boolean
  addOntology?: boolean
  addActivity?: boolean
  addTransactions?: boolean
}

export async function createReport(
  tenantId: string,
  caseItem: Case,
  params: ReportParams,
  accountsService: AccountsService,
  transactionsRepository: MongoDbTransactionRepository,
  linkerService: LinkerService
): Promise<Report> {
  const {
    afterTimestamp,
    addUserDetails = true,
    addPaymentDetails = true,
    addAlertDetails = true,
    addOntology = true,
    addActivity = true,
    addTransactions = true,
  } = params
  const sheets: Sheet[] = [
    addUserDetails && exportUserDetails(caseItem),
    addPaymentDetails && exportPaymentDetailsSheet(caseItem),
    addAlertDetails && exportAlertDetails(caseItem),
    addOntology &&
      (await exportOntology(caseItem, afterTimestamp, linkerService)),
    addActivity && (await exportActivity(tenantId, caseItem, accountsService)),
    addTransactions &&
      (await exportTransactions(caseItem, transactionsRepository)),
  ].filter(notEmpty)

  return sheets
}

function exportUserDetails(caseItem: Case): Sheet {
  const user =
    caseItem.caseUsers?.origin ?? caseItem.caseUsers?.destination ?? undefined

  const sections: Item[] = []

  if (user != null && isBusinessUser(user)) {
    sections.push({
      section: 'User details',
      children: [
        {
          section: 'Legal entity',
          children: [
            [
              'Business industry',
              user.legalEntity.companyGeneralDetails?.businessIndustry?.join(
                STRING_JOINER
              ),
            ],
            [
              'Main products and services',
              user.legalEntity.companyGeneralDetails?.mainProductsServicesSold?.join(
                STRING_JOINER
              ),
            ],
            ...(user.legalEntity?.reasonForAccountOpening?.length
              ? [
                  [
                    'Reason for opening account',
                    user.legalEntity?.reasonForAccountOpening?.join(
                      STRING_JOINER
                    ),
                  ],
                ]
              : []),
            ...(user.legalEntity?.sourceOfFunds?.length
              ? [
                  [
                    'Source of funds',
                    user.legalEntity?.sourceOfFunds.join(STRING_JOINER),
                  ],
                ]
              : []),
            [
              'Allowed payment methods',
              user.allowedPaymentMethods?.join(STRING_JOINER),
            ],
            ['Created at', exportTimestamp(user.createdTimestamp)],
            // todo: add 'Ongoing sanctions screening'
            ['Acquisition channel', user.acquisitionChannel],
            ...(user.mccDetails?.code
              ? [['MCC Code', user.mccDetails.code]]
              : []),
            ...(user.mccDetails?.description
              ? [['MCC Description', user.mccDetails.description]]
              : []),
          ],
        },
        {
          section: 'Contact details',
          children: [
            [
              'Email',
              user.legalEntity.contactDetails?.emailIds?.join(STRING_JOINER),
            ],
            [
              'Tel.',
              user.legalEntity.contactDetails?.contactNumbers?.join(
                STRING_JOINER
              ),
            ],
            [
              'Fax',
              user.legalEntity.contactDetails?.faxNumbers?.join(STRING_JOINER),
            ],
            [
              'Website',
              user.legalEntity.contactDetails?.websites?.join(STRING_JOINER),
            ],
            ...(user.legalEntity.contactDetails?.addresses ?? []).map(
              (address, i) => ({
                section: `Address #${i + 1}`,
                children: exportAddress(address),
              })
            ),
          ],
        },
        {
          section: 'Registration details',
          children: exportContactDetails(user.legalEntity?.contactDetails),
        },
        ...exportTags(user.tags),
        {
          section: 'Financial details',
          children: exportFinantialDetails(user),
        },
        // ['Linked entities'], // todo: implement
        ['Merchant category code', user.mccDetails?.code],
        ['Merchant category description', user.mccDetails?.description],
        exportSavedPaymentDetails(user),
      ],
    })
    sections.push(
      ...(user.shareHolders ?? []).map((person, i) => ({
        section: `Shareholder #${i + 1}`,
        children: exportPerson(person),
      }))
    )
    sections.push(
      ...(user.directors ?? []).map((person, i) => ({
        section: `Director #${i + 1}`,
        children: exportPerson(person),
      }))
    )
  } else if (user != null && isConsumerUser(user)) {
    sections.push({
      section: 'General details',
      children: [
        ['Date of birth', user.userDetails?.dateOfBirth],
        [
          'Country of nationality',
          exportCountry(user.userDetails?.countryOfNationality),
        ],
        [
          'Country of residence',
          exportCountry(user.userDetails?.countryOfResidence),
        ],
        ['Created timestamp', exportTimestamp(user.createdTimestamp)],
        ['Marital status', user.userDetails?.maritalStatus],
        ['Gender', user.userDetails?.gender],
        ['Place of birth', user.userDetails?.placeOfBirth],
        ['Occupation', user.occupation],
        ['User segment', user.userSegment],
        ['User category', user.userDetails?.userCategory],
        ['Acquisition channel', user.acquisitionChannel],
        ['Employment status', user.employmentStatus],
        ...Object.entries(user.expectedIncome ?? {})
          .filter(([_key, value]) => value != null)
          .map(([key, value]) => [
            'Expected income ' + humanizeAuto(key),
            value,
          ]),
        ['Employment sector', user.employmentDetails?.employmentSector],
        ['Business industry', user.employmentDetails?.businessIndustry],
        ['Employer name', user.employmentDetails?.employerName],
        [
          'Reason for account opening',
          user.reasonForAccountOpening?.join(STRING_JOINER),
        ],
        ['Source of funds', user.sourceOfFunds?.join(STRING_JOINER)],
        [
          'PEP Status',
          user.pepStatus
            ?.filter((pep) => pep.isPepHit != null)
            .map(
              ({ pepCountry, isPepHit }) =>
                `${exportCountry(pepCountry)} ${isPepHit ? '(Yes)' : '(No)'}`
            ),
        ],
      ],
    })
    sections.push({
      section: 'Contact details',
      children: exportContactDetails(user.contactDetails),
    })
    sections.push(...exportLegalDocuments(user.legalDocuments ?? [])),
      sections.push({
        section: 'Tags',
        children: user.tags?.map((tag) => [tag.key, tag.value]) ?? [],
      })
    sections.push(exportSavedPaymentDetails(user))
  }

  return {
    sheet: 'User details',
    children: sections,
  }
}

function exportPaymentDetailsSheet(caseItem: Case): Sheet {
  const paymentDetails =
    caseItem.paymentDetails?.origin ??
    caseItem.paymentDetails?.destination ??
    undefined

  return {
    sheet: 'Payment details',
    children: exportPaymentDetails(paymentDetails),
  }
}

function exportAlertDetails(caseItem: Case): Sheet {
  // todo: implement derived?
  // Assigned to
  // Assigned to role
  const props = [
    'priority',
    'alertId',
    'caseId',
    'createdTimestamp',
    'age',
    'numberOfTransactionsHit',
    'caseUserId',
    'caseUserName',
    'ruleName',
    'ruleDescription',
    'ruleAction',
    'ruleNature',
    'alertStatus',
    // 'statusChanges',
    // 'lastStatusChangeReasons',
    'ruleQaStatus',
    'caseCreatedTimestamp',
    'updatedAt',
    // 'assignments',
    'ruleQueueId',
    'creationReason',
    'alertStatus',
    // 'lastStatusChange',
    'comments',
  ]

  const user =
    caseItem.caseUsers?.origin ?? caseItem.caseUsers?.destination ?? undefined

  const header: string[] = props.map((prop) => humanizeAuto(prop))
  return {
    sheet: 'Alert details',
    children: [
      {
        header,
        rows: (caseItem.alerts ?? [])
          .map((alert) => {
            return {
              ...alert,
              caseCreatedTimestamp: exportTimestamp(caseItem.createdTimestamp),
              caseUserName: getUserName(user),
              age: pluralize(
                'day',
                Math.floor(
                  duration(Date.now() - alert.createdTimestamp).asDays()
                ),
                true
              ),
              caseUserId: user?.userId ?? '',
              caseType: caseItem.caseType,
              user: user,
              lastStatusChangeReasons: {
                reasons: alert.lastStatusChange?.reason ?? [],
                otherReason: alert.lastStatusChange?.otherReason ?? null,
              },
              comments: alert.comments
                ? alert.comments.map((comment) => comment.body).join('\n')
                : '',
            }
          })
          .map((alert) => props.map((prop) => alert[prop])),
      },
    ],
  }
}

async function exportOntology(
  caseItem: Case,
  afterTimestamp: number,
  linkerService: LinkerService
): Promise<Sheet> {
  const user =
    caseItem.caseUsers?.origin ?? caseItem.caseUsers?.destination ?? undefined
  const result: Item[] = []
  if (user?.userId != null) {
    const entityGraph = await linkerService.entityGraph(
      user.userId,
      afterTimestamp
    )
    result.push({
      section: 'Entity view',
      children: [exportEntityGraph(entityGraph)],
    })
    const transactionsGraph = await linkerService.transactions(
      user.userId,
      afterTimestamp
    )
    result.push([])
    result.push({
      section: 'Transactions view',
      children: [exportEntityGraph(transactionsGraph)],
    })
  }
  return { sheet: 'Ontology', children: result }
}

async function exportTransactions(
  caseItem: Case,
  transactionsRepository: MongoDbTransactionRepository
): Promise<Sheet> {
  // caseItem.caseTransactionsIds
  const transactions = await transactionsRepository.getTransactionsByIds(
    caseItem.caseTransactionsIds ?? []
  )
  return {
    sheet: 'Transaction history',
    children: transactions.map((transaction) => ({
      section: 'Transaction ' + transaction.transactionId,
      children: [
        ['Type', transaction.type],
        ['Transaction ID', transaction.transactionId],
        ['Timestamp', exportTimestamp(transaction.timestamp)],
        ['Origin user ID', transaction.originUserId],
        ['Destination user ID', transaction.destinationUserId],
        ['Transaction state', transaction.transactionState],
        {
          section: 'Origin amount details',
          children: exportAmountDetails(transaction.originAmountDetails),
        },
        {
          section: 'Destination amount details',
          children: exportAmountDetails(transaction.destinationAmountDetails),
        },
        {
          section: 'Origin payment details',
          children: exportPaymentDetails(transaction.originPaymentDetails),
        },
        {
          section: 'Destination payment details',
          children: exportPaymentDetails(transaction.destinationPaymentDetails),
        },
        {
          section: 'Origin funds info',
          children: exportAnything(transaction.originFundsInfo),
        },
        [
          'Related transaction IDs',
          transaction.relatedTransactionIds?.join(STRING_JOINER),
        ],
        ['Product type', transaction.productType],
        ['Promotion code used', transaction.promotionCodeUsed],
        ['Reference', transaction.reference],
        {
          section: 'Origin device data',
          children: exportAnything(transaction.originDeviceData),
        },
        {
          section: 'Destination device data',
          children: exportAnything(transaction.destinationDeviceData),
        },
        ...exportTags(transaction.tags),
        {
          section: 'Executed rules',
          children: transaction.executedRules.map((rule, i) => ({
            section: `Executed rule ${i + 1}`,
            children: exportRule(rule),
          })),
        },
        {
          section: 'Hit rules',
          children: transaction.hitRules.map((rule, i) => ({
            section: `Hit rule ${i + 1}`,
            children: exportRule(rule),
          })),
        },
        ['Status', transaction.status],
        {
          section: 'Risk score details',
          children: exportAnything(transaction.riskScoreDetails),
        },
        ['Origin payment method ID', transaction.originPaymentMethodId],
        [
          'Destination payment method ID',
          transaction.destinationPaymentMethodId,
        ],
        {
          section: 'Events',
          children: (transaction.events ?? []).map((event, i) => ({
            section: 'Event #' + (i + 1),
            children: exportAnything(event),
          })),
        },
        {
          section: 'ARS score',
          children: exportAnything(transaction.arsScore),
        },
        ['Created at', exportTimestamp(transaction.createdAt)],
        ['Updated at', exportTimestamp(transaction.updatedAt)],
      ],
    })),
  }
}

async function exportActivity(
  tenantId: string,
  caseItem: Case,
  accountsService: AccountsService
): Promise<Sheet> {
  const allAccountIds = [
    ...(caseItem.comments ?? []).map(({ userId }) => userId),
    ...(caseItem.alerts ?? []).flatMap((alert) =>
      alert.comments?.map(({ userId }) => userId)
    ),
  ].filter(notEmpty)
  const accounts = await accountsService.getAccounts(tenantId, allAccountIds)
  const exportComment = (comment) => {
    const account = accounts.find((x) => x.id === comment.userId)
    // todo: add files links?
    const name = account?.name ?? account?.email ?? comment.userId
    const date = exportTimestamp(comment.createdAt)
    return {
      section: `Comment by ${name} (${date})`,
      children: [[comment.body]],
    }
  }
  return {
    sheet: 'Activity',
    children: [
      ...(caseItem.comments?.length
        ? [
            {
              section: 'Case comments',
              children: caseItem.comments.map(exportComment),
            },
          ]
        : []),
      ...(caseItem.alerts ?? [])
        .filter((alert) => !!alert.comments?.length)
        .map((alert) => {
          return {
            section: `Alert ${alert.alertId} comments`,
            children: (alert.comments ?? []).map(exportComment),
          }
        }),
    ],
  }
}

/*
  Helpers
 */
const STRING_JOINER = '; '

function isConsumerUser(
  user: InternalConsumerUser | InternalBusinessUser | MissingUser
): user is InternalConsumerUser {
  return user != null && 'type' in user && user.type === 'CONSUMER'
}

function isBusinessUser(
  user: InternalConsumerUser | InternalBusinessUser | MissingUser
): user is InternalBusinessUser {
  return user != null && 'type' in user && user.type === 'BUSINESS'
}

function exportAnything(value?: unknown): Item[] {
  if (Array.isArray(value)) {
    if (value.every(isSimpleValue)) {
      return [[value.filter(notEmpty).join(STRING_JOINER)]]
    }
    return value.map(
      (item, i): Item => ({
        section: `Item ${i + 1}`,
        children: exportAnything(item),
      })
    )
  }
  if (typeof value == null || typeof value === 'object') {
    return Object.entries(value ?? {}).map(([key, value]): Item => {
      if (isSimpleValue(value)) {
        let exportedValue = value
        if (key === 'country') {
          exportedValue = exportCountry(value as CountryCode)
        }
        return [humanizeAuto(key), exportedValue]
      }
      if (Array.isArray(value) && value.every(isSimpleValue)) {
        return [humanizeAuto(key), value.filter(notEmpty).join(STRING_JOINER)]
      }
      return {
        section: humanizeAuto(key),
        children: exportAnything(value),
      }
    })
  }
  return [[`${value}`]]
}

function exportAmountDetails(
  amountDetails: TransactionAmountDetails | undefined
) {
  return exportAnything(amountDetails)
}

function exportRule(rule) {
  return exportAnything(rule)
}

function exportEntityGraph(entityGraph: EntityGraph): Table {
  const formatId = (id: string | undefined): string => {
    if (id == null) {
      return ''
    }
    const match = id.match(/^(.+?):(.+)$/)
    if (match) {
      const [_, type, value] = match
      if (type === 'user') {
        return `User ID: ${value}`
      }
      if (type === 'emailAddress') {
        return `Email: ${value}`
      }
      if (type === 'address') {
        return `Address: ${value}`
      }
      if (type === 'contactNumber') {
        return `Contact number: ${value}`
      }
      if (type === 'payment') {
        return `Payment: ${value}`
      }
      if (type === 'parent') {
        return `Parent: ${value}`
      }
      if (type === 'child') {
        return `Child: ${value}`
      }
    }
    return id
  }

  const rows: Row[] = []
  for (const columnNode of entityGraph.nodes) {
    const row: Row = []
    for (const rowNode of entityGraph.nodes) {
      const isConnected = entityGraph.edges.some(
        ({ source, target }) =>
          source === columnNode.id && target === rowNode.id
      )
      row.push(isConnected ? 'connected' : '')
    }
    rows.push(row)
  }

  return {
    header: entityGraph.nodes.map((x) => x.label || formatId(x.id)),
    columnHeader: entityGraph.nodes.map((x) => x.label || formatId(x.id)),
    rows: rows,
  }
}

function exportLegalDocuments(legalDocuments: LegalDocument[]): Item[] {
  return (legalDocuments ?? []).map((activeItem, i) => ({
    section: `Legal document #${i + 1}`,
    children: [
      ['Document type', activeItem.documentType],
      ['Document number', activeItem.documentNumber],
      ['Name on document', formatConsumerName(activeItem.nameOnDocument)],
      [
        'Document issued country',
        exportCountry(activeItem.documentIssuedCountry),
      ],
      ['Document issued date', exportTimestamp(activeItem.documentIssuedDate)],
      [
        'Document expiration date',
        exportTimestamp(activeItem.documentExpirationDate),
      ],
      ...exportTags(activeItem.tags),
    ],
  }))
}

function exportCountry(
  code: CountryCode | undefined | false
): string | undefined {
  return code ? COUNTRIES[code] : undefined
}

function exportTimestamp(value: number | undefined): string | undefined {
  return value ? dayjs(value).format() : undefined
}

function exportFinantialDetails(user: InternalBusinessUser) {
  const financialDetails = user.legalEntity.companyFinancialDetails
  return [
    [
      'Expected total transaction volume per month',
      `${financialDetails?.expectedTransactionAmountPerMonth?.amountValue?.toLocaleString()} ${
        financialDetails?.expectedTransactionAmountPerMonth?.amountCurrency
      }`,
    ],
    [
      'Expected revenue per month',
      `${financialDetails?.expectedTurnoverPerMonth?.amountValue?.toLocaleString()}  ${
        financialDetails?.expectedTurnoverPerMonth?.amountCurrency
      }`,
    ],
    ...exportTags(financialDetails?.tags),
  ]
}

function exportPerson(person: Person | LegalEntity): Item[] {
  if (isPerson(person)) {
    const { generalDetails, tags } = person
    return [
      {
        section: 'General details',
        children: [
          ['First name', formatConsumerName(generalDetails.name)],
          ['Date of birth', generalDetails.dateOfBirth],
          ['Gender', generalDetails.gender],
          [
            'Country of residence',
            exportCountry(generalDetails.countryOfResidence),
          ],
          [
            'Country of nationality',
            exportCountry(generalDetails.countryOfNationality),
          ],
          ...exportTags(tags),
        ],
      },
      {
        section: 'Contact details',
        children: exportContactDetails(person.contactDetails),
      },
      ...exportLegalDocuments(person.legalDocuments ?? []),
    ]
  } else {
    // LegalEntity
    const { companyGeneralDetails } = person
    return [
      {
        section: 'General details',
        children: [
          ['Legal name', companyGeneralDetails?.legalName],
          [
            'Business industry',
            companyGeneralDetails?.businessIndustry?.join(STRING_JOINER),
          ],
          [
            'Main products and services',
            companyGeneralDetails?.mainProductsServicesSold?.join(
              STRING_JOINER
            ),
          ],
          [
            'Operating countries',
            companyGeneralDetails?.operatingCountries
              ?.map((code) => exportCountry(code))
              .filter(notEmpty)
              .join(STRING_JOINER),
          ],
          ['Alias', companyGeneralDetails?.alias?.join(STRING_JOINER)],
          ['User segment', companyGeneralDetails?.userSegment],
          [
            'User registration status',
            companyGeneralDetails?.userRegistrationStatus,
          ],
          ...exportTags(companyGeneralDetails?.tags),
        ],
      },
      {
        section: 'Contact details',
        children: exportContactDetails(person.contactDetails),
      },
      ...(person.companyFinancialDetails
        ? [
            {
              section: 'Financial details',
              children: [
                [
                  'Expected total transaction volume per month',
                  `${person.companyFinancialDetails?.expectedTransactionAmountPerMonth?.amountValue?.toLocaleString()} ${
                    person.companyFinancialDetails
                      ?.expectedTransactionAmountPerMonth?.amountCurrency
                  }`,
                ],
                [
                  'Expected revenue per month',
                  `${person.companyFinancialDetails?.expectedTurnoverPerMonth?.amountValue?.toLocaleString()} ${
                    person.companyFinancialDetails?.expectedTurnoverPerMonth
                      ?.amountCurrency
                  }`,
                ],
                ...exportTags(person.companyFinancialDetails?.tags),
              ],
            },
          ]
        : []),
      ...(person.companyRegistrationDetails
        ? [
            {
              section: 'Registration details',
              children: exportAnything(person.companyRegistrationDetails),
            },
          ]
        : []),
      ...(person.reasonForAccountOpening?.length
        ? [
            [
              'Reason for opening account',
              person.reasonForAccountOpening.join(STRING_JOINER),
            ],
          ]
        : []),
      ...(person.sourceOfFunds?.length
        ? [['Source of funds', person.sourceOfFunds.join(STRING_JOINER)]]
        : []),
    ]
  }
}

function exportSavedPaymentDetails(
  user: InternalConsumerUser | InternalBusinessUser | undefined
): Section {
  return {
    section: 'Saved payment details',
    children: (user?.savedPaymentDetails ?? []).flatMap((paymentDetails) => [
      ['Method', getPaymentMethodTitle(paymentDetails.method)],
      ['ID', getPaymentDetailsIdString(paymentDetails)],
    ]),
  }
}

function exportPaymentDetails(
  paymentDetails?:
    | CardDetails
    | GenericBankAccountDetails
    | IBANDetails
    | ACHDetails
    | SWIFTDetails
    | MpesaDetails
    | UPIDetails
    | WalletDetails
    | CheckDetails
    | CashDetails
    | NPPDetails
): Item[] {
  return exportAnything(paymentDetails)
}

function exportTags(tags): Item[] {
  if (tags == null || tags.length === 0) {
    return []
  }
  return [
    {
      section: 'Tags',
      children: (tags ?? []).map(({ key, value }) => [key, value]),
    },
  ]
}

function exportContactDetails(
  contactDetails: ContactDetails | undefined
): Item[] {
  return [
    ['Email', contactDetails?.emailIds?.join(STRING_JOINER)],
    ['Tel', contactDetails?.contactNumbers?.join(STRING_JOINER)],
    ['Fax', contactDetails?.faxNumbers?.join(STRING_JOINER)],
    ['Website', contactDetails?.websites?.join(STRING_JOINER)],
    ...(contactDetails?.addresses ?? []).map((address) => ({
      section: 'Address',
      children: exportAddress(address),
    })),
  ]
}

function exportAddress(address: Address): Item[] {
  return [
    ['Address lines', address.addressLines.join(STRING_JOINER)],
    ['Postcode', address.postcode],
    ['City', address.city],
    ['State', address.state],
    ['Country', address.country],
    ['Address type', address.addressType],
    ...exportTags(address.tags),
  ]
}

export function getPaymentDetailsIdString(
  paymentDetails: PaymentDetails
): string {
  if (paymentDetails.method === 'IBAN') {
    return paymentDetails.IBAN ?? paymentDetails.name ?? '-'
  } else if (paymentDetails.method === 'ACH') {
    return paymentDetails.accountNumber ?? '-'
  } else if (paymentDetails.method === 'SWIFT') {
    return [paymentDetails.swiftCode, paymentDetails.accountNumber]
      .filter(notEmpty)
      .join('/')
  } else if (paymentDetails.method === 'GENERIC_BANK_ACCOUNT') {
    return paymentDetails.accountNumber ?? '-'
  } else if (paymentDetails.method === 'WALLET') {
    return paymentDetails.walletId ?? '-'
  } else if (paymentDetails.method === 'UPI') {
    return paymentDetails.upiID ?? '-'
  } else if (paymentDetails.method === 'CARD') {
    return `XXXX ${paymentDetails.cardLast4Digits ?? '-'}`
  } else if (paymentDetails.method === 'MPESA') {
    return paymentDetails.businessShortCode ?? '-'
  } else if (paymentDetails.method === 'CHECK') {
    return paymentDetails.checkIdentifier ?? '-'
  } else if (paymentDetails.method === 'CASH') {
    return paymentDetails.identifier ?? '-'
  } else if (paymentDetails.method === 'NPP') {
    return paymentDetails.payId ?? '-'
  } else {
    return neverReturn(paymentDetails, '-')
  }
}

export function getPaymentMethodTitle(paymentMethod: PaymentMethod) {
  if (paymentMethod === 'IBAN') {
    return 'IBAN transfer'
  } else if (paymentMethod === 'ACH') {
    return 'ACH transfer'
  } else if (paymentMethod === 'SWIFT') {
    return 'SWIFT transfer'
  } else if (paymentMethod === 'GENERIC_BANK_ACCOUNT') {
    return 'Bank transfer'
  } else if (paymentMethod === 'WALLET') {
    return 'Wallet'
  } else if (paymentMethod === 'UPI') {
    return 'UPI'
  } else if (paymentMethod === 'CARD') {
    return 'Card'
  } else if (paymentMethod === 'MPESA') {
    return 'Mpesa'
  } else if (paymentMethod === 'CHECK') {
    return 'Check'
  } else if (paymentMethod === 'CASH') {
    return 'Cash'
  } else if (paymentMethod === 'NPP') {
    return 'NPP'
  } else {
    return neverReturn(paymentMethod, humanizeConstant(paymentMethod))
  }
}
