import { schema } from './schema'
import { Account } from '@/@types/openapi-internal/Account'
import { Case } from '@/@types/openapi-internal/Case'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { ReportParameters } from '@/@types/openapi-internal/ReportParameters'
import {
  GenerateResult,
  InternalReportType,
  ReportGenerator,
} from '@/services/sar/generators'
import { ReportSchema } from '@/@types/openapi-internal/ReportSchema'
import { Report } from '@/@types/openapi-internal/Report'
import dayjs from '@/utils/dayjs'
import {
  generatePdf,
  grid,
  h,
  p,
  ReportDocument,
  ReportResultItem,
  textField,
} from '@/services/sar/generators/MY/STR/report-builder'
import { CurrencyService } from '@/services/currency'
import { notEmpty } from '@/utils/array'
import {
  TransactionMethod as ReportTransactionMethod,
  TransactionType as ReportTransactionType,
} from '@/services/sar/generators/MY/STR/schema-types/enums'
import { neverReturn } from '@/utils/lang'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { MissingUser } from '@/@types/openapi-internal/MissingUser'
import { getDynamoDbClient } from '@/utils/dynamodb'

export class MalaysianSTRReportGenerator implements ReportGenerator {
  getType(): InternalReportType {
    return {
      type: 'STR',
      countryCode: 'MY',
      directSubmission: false,
      subjectTypes: ['CASE', 'USER'],
    }
  }

  private async genericPopulatedParameters(
    subject:
      | { type: 'CASE'; case: Case }
      | { type: 'USER'; user: InternalBusinessUser | InternalConsumerUser },
    transactions: InternalTransaction[],
    _reporter: Account
  ) {
    const dynamoDb = getDynamoDbClient()
    const currencyService = new CurrencyService(dynamoDb)

    const customerAndAccountDetails = {
      customerInformation: {
        title: undefined,
        name: undefined,
        otherNameAlias: undefined,
        gender: undefined,
        identificationNoNric: undefined,
        identificationNoPassport: undefined,
        dateOfBirth: undefined,
        otherId: undefined,
        residentialAddress: {
          streetAddress: undefined,
          state: undefined,
          nationality: 'MY',
        },
        correspondenceAddress: {
          streetAddress: undefined,
          state: undefined,
          nationality: 'MY',
        },
        emailID: undefined,
        customerAmlRating: undefined,
        contactNumber: undefined,
        occupation: undefined,
        occupationDescription: undefined,
      },
      accountDetails: {
        accountNo: undefined,
        accountOpeningDate: undefined,
        accountStatus: undefined,
        currentPortfolioValueRm: undefined,
        otherAccountsOrProductsMaintainedByCustomer: {
          accountNo: undefined,
          productName: undefined,
          typeOfProduct: undefined,
          currentPortfolioValueRm: undefined,
          dateOfProductPurchase: undefined,
        },
        fundManagerAgentSalesPersonMarketingRepresentative: {
          name: undefined,
          identificationNoNricPassport: undefined,
          cmsrlLicenseNoUtcOrPrcFimmNo: undefined,
          contactNumber: undefined,
        },
      },
    } as any

    let caseUser:
      | InternalBusinessUser
      | InternalConsumerUser
      | MissingUser
      | undefined = undefined
    if (subject.type === 'USER') {
      caseUser = subject.user
    } else {
      if (subject.case.subjectType !== 'PAYMENT') {
        caseUser =
          subject.case.caseUsers?.origin ??
          subject.case.caseUsers?.destination ??
          undefined
      }
    }

    let paymentDetails
    if (subject.type === 'CASE') {
      if (subject.case.subjectType !== 'USER') {
        paymentDetails =
          subject.case.paymentDetails?.origin ??
          subject.case.paymentDetails?.destination ??
          undefined
      }
    }

    if (caseUser != null) {
      if (caseUser != null && 'type' in caseUser) {
        if (caseUser.type === 'CONSUMER') {
          const { userDetails } = caseUser

          customerAndAccountDetails.accountDetails.accountNo = caseUser.userId

          const dob = caseUser.userDetails?.dateOfBirth
          // NRIC of a person in malaysia starts with YYMMDD followed by 7 digits
          const prefixOfNRIC = dob ? dayjs(dob).format('YYMMDD') : undefined
          if (prefixOfNRIC) {
            const legalDocuments = caseUser.legalDocuments
            if (legalDocuments) {
              const document = legalDocuments.find((document) => {
                return document.documentNumber.startsWith(prefixOfNRIC)
              })
              if (document) {
                customerAndAccountDetails.customerInformation.identificationNoNric =
                  document.documentNumber
              }
            }
          }

          customerAndAccountDetails.customerInformation.gender =
            userDetails?.gender === 'M'
              ? 'MALE'
              : userDetails?.gender === 'F'
              ? 'FEMALE'
              : 'UNKNOWN'
          if (userDetails?.name) {
            customerAndAccountDetails.customerInformation.name = [
              userDetails.name?.firstName,
              userDetails.name?.middleName,
              userDetails.name?.lastName,
            ]
              .filter(Boolean)
              .join(' ')
          }

          if (userDetails?.countryOfResidence) {
            customerAndAccountDetails.customerInformation.residentialAddress.nationality =
              userDetails?.countryOfResidence
          }
          if (userDetails?.dateOfBirth) {
            customerAndAccountDetails.customerInformation.dateOfBirth =
              userDetails.dateOfBirth
          }
        } else {
          const { legalEntity } = caseUser
          if (legalEntity) {
            customerAndAccountDetails.customerInformation.name =
              legalEntity?.companyGeneralDetails?.legalName
          }
        }
      }

      let contactDetails
      if (caseUser != null && 'type' in caseUser) {
        if (caseUser.type === 'CONSUMER') {
          contactDetails = caseUser?.contactDetails
        } else {
          contactDetails = caseUser?.legalEntity?.contactDetails
        }
      }
      if (contactDetails?.addresses) {
        const [address] = contactDetails.addresses
        customerAndAccountDetails.customerInformation.correspondenceAddress = {
          streetAddress: address.addressLines.join('; '),
          state: address.state,
          nationality: address.country,
          zipCode: address.postcode,
          city: address.city,
        }

        customerAndAccountDetails.customerInformation.residentialAddress = {
          streetAddress: address.addressLines.join('; '),
          state: address.state,
          nationality: address.country,
          zipCode: address.postcode,
          city: address.city,
        }
      }
    } else if (paymentDetails != null) {
      if (paymentDetails.method === 'GENERIC_BANK_ACCOUNT') {
        customerAndAccountDetails.accountDetails.accountNo =
          paymentDetails.accountNumber
      }
    }

    return {
      report: {
        reportDetailsAndSTRNature: {
          reportDetails: {
            name: undefined,
            description: undefined,
            type: 'STR',
            dateOfCreation: dayjs().format(),
          },
          natureOfStr: {
            attemptedButNotCompleted: false,
            strIsReportedDueTo: 'INTERNAL MONITORING/TRIGGER',
            stateRelevantSource: 'INTERNAL MONITORING/TRIGGER',
          },
        },
        rIandBasisOfSuspicion: {
          reportInstitution: {
            reportingOnBehalfOf: undefined,
          },
          basisOfSuspicion: {
            suspectedPredicateOffence: undefined,
            redFlagIndicator: undefined,
            descriptionOfTransactionPatternAndEntitiesConnectedToTheSuspiciousActivities:
              undefined,
            detailsAndReasonsToSupportBasisOfSuspicion: undefined,
            actionsTakenByReportingInstitution: undefined,
            keywordsRelatedToTheReport: undefined,
            relatedToPoliticallyExposedPersonsPEPs: false,
          },
        },
      },
      customerAndAccountDetails: customerAndAccountDetails,
      transactions: await Promise.all(
        transactions.map(async (transaction) => {
          // Derive transaction amount
          const amounts = await Promise.all(
            [
              transaction.originAmountDetails,
              transaction.destinationAmountDetails,
            ]
              .filter(notEmpty)
              .map((amount) =>
                currencyService.getTargetCurrencyAmount(amount, 'MYR')
              )
          )
          const maxAmount = Math.max(
            ...amounts.map(({ transactionAmount }) => transactionAmount)
          )

          // Derive transaction type
          let reportTransactionType:
            | (typeof ReportTransactionType)['enum'][number]
            | undefined
          if (transaction.type === 'DEPOSIT') {
            reportTransactionType = 'DEPOSIT'
          } else if (transaction.type === 'TRANSFER') {
            if (caseUser != null) {
              if (transaction.originUserId === caseUser.userId) {
                reportTransactionType = 'TRANSFER-OUT'
              } else if (transaction.destinationUserId === caseUser.userId) {
                reportTransactionType = 'TRANSFER-IN'
              }
            } else if (
              subject.type === 'CASE' &&
              subject.case.subjectType === 'PAYMENT' &&
              subject.case.alerts?.some((alert) =>
                alert.ruleHitMeta?.hitDirections?.includes('DESTINATION')
              )
            ) {
              reportTransactionType = 'TRANSFER-OUT'
            } else {
              reportTransactionType = 'TRANSFER-IN'
            }
          } else if (transaction.type === 'EXTERNAL_PAYMENT') {
            reportTransactionType = 'PAYMENT*'
          } else if (transaction.type === 'WITHDRAWAL') {
            reportTransactionType = 'WITHDRAWAL'
          } else if (transaction.type === 'REFUND') {
            // todo: check that logic is valid
            reportTransactionType = 'OTHERS'
          } else {
            reportTransactionType = 'OTHERS'
          }

          // Derive transaction method
          let transactionMethod:
            | (typeof ReportTransactionMethod)['enum'][number]
            | undefined = undefined
          const paymentDetails =
            transaction.originPaymentDetails ||
            transaction.destinationPaymentDetails
          if (paymentDetails) {
            if (paymentDetails.method === 'ACH') {
              transactionMethod = ''
            } else if (paymentDetails.method === 'CARD') {
              transactionMethod = 'CREDIT CARD'
            } else if (paymentDetails.method === 'IBAN') {
              transactionMethod = `BANK'S ORDER`
            } else if (paymentDetails.method === 'UPI') {
              // todo: check that logic is valid
              transactionMethod = undefined
            } else if (paymentDetails.method === 'GENERIC_BANK_ACCOUNT') {
              transactionMethod = `BANK'S ORDER`
            } else if (paymentDetails.method === 'MPESA') {
              // todo: check that logic is valid
              transactionMethod = undefined
            } else if (paymentDetails.method === 'SWIFT') {
              transactionMethod = `BANK'S ORDER`
            } else if (paymentDetails.method === 'WALLET') {
              // todo: check that logic is valid
              transactionMethod = undefined
            } else if (paymentDetails.method === 'CHECK') {
              transactionMethod = 'CHEQUE'
            } else if (paymentDetails.method === 'CASH') {
              transactionMethod = 'CASH'
            } else if (paymentDetails.method === 'NPP') {
              transactionMethod = 'NPP'
            } else {
              transactionMethod = neverReturn(paymentDetails, undefined)
            }
          }

          return {
            id: transaction.transactionId,
            transaction: {
              productDetails: {
                productName: undefined,
                typeOfProduct: undefined,
                currentProductValueRm: undefined,
                dateOfProductPurchase: undefined,
              },
              transactionDetails: {
                transactionAmountRm: (
                  Math.round(maxAmount * 100) / 100
                ).toString(), // todo: make a proper money formatting
                rangingTransactionDate: transaction.createdAt
                  ? dayjs(transaction.createdAt).format()
                  : undefined,
                transactionType: reportTransactionType,
                transactionMethod: transactionMethod,
              },
            },
          }
        })
      ),
    }
  }

  async getUserPopulatedParameters(
    user: InternalConsumerUser | InternalBusinessUser,
    transactions: InternalTransaction[],
    reporter: Account
  ) {
    return this.genericPopulatedParameters(
      {
        type: 'USER',
        user: user,
      },
      transactions,
      reporter
    )
  }

  async getPopulatedParameters(
    caseItem: Case,
    transactions: InternalTransaction[],
    reporter: Account
  ): Promise<ReportParameters> {
    return this.genericPopulatedParameters(
      {
        type: 'CASE',
        case: caseItem,
      },
      transactions,
      reporter
    )
  }

  public getSchema(): ReportSchema {
    return {
      reportSchema: {
        ...schema.properties.reportSchema,
        definitions: schema.definitions,
      },
      customerAndAccountDetailsSchema: {
        ...schema.properties.customerAndAccountDetailsSchema,
        definitions: schema.definitions,
      },
      transactionSchema: {
        ...schema.properties.transactionSchema,
        definitions: schema.definitions,
      },
      settings: {
        propertyNameStyle: 'CAMEL_CASE',
        disableAttachmentsStep: true,
      },
    }
  }

  public getAugmentedReportParams(report: Report): ReportParameters {
    return report.parameters
  }

  public async generate(
    reportParams: ReportParameters
  ): Promise<GenerateResult> {
    const document: ReportDocument = [
      h(1, 'SUSPICIOUS TRANSACTION REPORT'),
      ...this.generatePrelude(reportParams),
      ...this.generatePartA(reportParams),
      // ...this.generatePartB(reportParams),
      ...this.generatePartC(reportParams),
    ]

    const pdfData = await generatePdf(document)

    return {
      type: 'STREAM',
      contentType: 'PDF',
      stream: pdfData,
    }
  }

  private generatePrelude(reportParams: ReportParameters): ReportResultItem[] {
    const { reportDetailsAndSTRNature = {}, rIandBasisOfSuspicion = {} } =
      reportParams.report

    const { reportDetails, natureOfStr } = reportDetailsAndSTRNature

    const reportDetailsAndStrNatureItems = [
      h(3, 'Report details & STR nature'),
      grid([
        [p('Type'), textField(reportDetails?.str)],
        [p('Date of creation'), textField(reportDetails?.dateOfCreation)],
        [p('Name'), textField(reportDetails?.name)],
        [p('Description'), textField(reportDetails?.description)],
        [
          p('Attempted but not completed'),
          textField(natureOfStr?.attemptedButNotCompleted ? 'Yes' : 'No'),
        ],
        [
          p('STR is reported due to'),
          textField(natureOfStr?.strIsReportedDueTo),
        ],
        [
          p('State relevant source'),
          textField(natureOfStr?.stateRelevantSource),
        ],
      ]),
    ]

    const { reportInstitution = {}, basisOfSuspicion = {} } =
      rIandBasisOfSuspicion
    const riAndBasicOfSuspicionItems = [
      h(3, 'RI & Basis of suspicion'),
      grid([
        [
          p('Reporting on behalf of'),
          textField(reportInstitution.reportingOnBehalfOf),
        ],
        [
          p('Suspected predicate offence'),
          textField(basisOfSuspicion.suspectedPredicateOffence),
        ],
        [p('Red flag indicator'), textField(basisOfSuspicion.redFlagIndicator)],
        [
          p(
            'Description of transaction pattern and entities connected to the suspicious activities'
          ),
          textField(
            basisOfSuspicion.descriptionOfTransactionPatternAndEntitiesConnectedToTheSuspiciousActivities
          ),
        ],
        [
          p('Details and reasons to support basis of suspicion'),
          textField(
            basisOfSuspicion.detailsAndReasonsToSupportBasisOfSuspicion
          ),
        ],
        [
          p('Actions taken by reporting institution'),
          textField(basisOfSuspicion.actionsTakenByReportingInstitution),
        ],
        [
          p('Keywords related to the report'),
          textField(basisOfSuspicion.keywordsRelatedToTheReport),
        ],
        [
          p('Related to politically exposed persons (PEPs)'),
          textField(basisOfSuspicion.relatedToPoliticallyExposedPersonsPEPs),
        ],
      ]),
    ]

    return [...reportDetailsAndStrNatureItems, ...riAndBasicOfSuspicionItems]
  }

  private generateAddress(address): ReportResultItem {
    const { streetAddress, state, nationality, zipCode, city } = address ?? {}
    return grid([
      [p('Street address'), textField(streetAddress)],
      [p('Nationality'), textField(nationality)],
      [p('State'), textField(state)],
      [p('ZIP code'), textField(zipCode)],
      [p('City'), textField(city)],
    ])
  }

  private generatePartA(reportParams: ReportParameters): ReportResultItem[] {
    const { customerAndAccountDetails = {} } = reportParams
    const { customerInformation = {}, accountDetails = {} } =
      customerAndAccountDetails
    const {
      otherAccountsOrProductsMaintainedByCustomer = {},
      fundManagerAgentSalesPersonMarketingRepresentative = {},
    } = accountDetails
    return [
      h(2, 'INFORMATION ON CUSTOMER'),
      h(3, 'Customer information'),
      grid([
        [p('Title'), textField(customerInformation.title)],
        [p('Name'), textField(customerInformation.name)],
        [p('Other name alias'), textField(customerInformation.otherNameAlias)],
        [p('Gender'), textField(customerInformation.gender)],
        [
          p('Identification no (NRIC)'),
          textField(customerInformation.identificationNoNric),
        ],
        [
          p('Identification no (Passport)'),
          textField(customerInformation.identificationNoPassport),
        ],
        [p('Date of birth'), textField(customerInformation.dateOfBirth)],
        [p('Other ID'), textField(customerInformation.otherId)],
        [
          p('Residential address'),
          this.generateAddress(customerInformation.residentialAddress),
        ],
        [
          p('Correspondence address'),
          this.generateAddress(customerInformation.correspondenceAddress),
        ],
        [p('Contact number'), textField(customerInformation.contactNumber)],
        [p('Occupation'), textField(customerInformation.occupation)],
        [
          p('Occupation description'),
          textField(customerInformation.occupationDescription),
        ],
      ]),
      h(3, 'Account details'),
      grid([
        [p('Account no'), textField(accountDetails.accountNo)],
        [
          p('Account opening date'),
          textField(accountDetails.accountOpeningDate),
        ],
        [p('Account status'), textField(accountDetails.accountStatus)],
        [
          p('Current portfolio value (RM)'),
          textField(accountDetails.currentPortfolioValueRm),
        ],
        [
          p('Account no'),
          textField(otherAccountsOrProductsMaintainedByCustomer.accountNo),
        ],
        [
          p('Product name'),
          textField(otherAccountsOrProductsMaintainedByCustomer.productName),
        ],
        [
          p('Type of product'),
          textField(otherAccountsOrProductsMaintainedByCustomer.typeOfProduct),
        ],
        [
          p('Current portfolio value (RM)'),
          textField(
            otherAccountsOrProductsMaintainedByCustomer.currentPortfolioValueRm
          ),
        ],
        [
          p('Date of product purchase'),
          textField(
            otherAccountsOrProductsMaintainedByCustomer.dateOfProductPurchase
          ),
        ],
        [
          p('CMSRL license no (UTC or PRC FIMM no)'),
          textField(
            otherAccountsOrProductsMaintainedByCustomer.cmsrlLicenseNoUtcOrPrcFimmNo
          ),
        ],
        [
          p('Contact number'),
          textField(otherAccountsOrProductsMaintainedByCustomer.contactNumber),
        ],
        [
          p('Name'),
          textField(fundManagerAgentSalesPersonMarketingRepresentative.name),
        ],
        [
          p('Identification no (NRIC/Passport)'),
          textField(
            fundManagerAgentSalesPersonMarketingRepresentative.identificationNoNricPassport
          ),
        ],
      ]),
    ]
  }

  private generatePartB(_reportParams: ReportParameters): ReportResultItem[] {
    return [h(2, 'TRANSACTION DETAILS')]
  }

  private generatePartC(reportParams: ReportParameters): ReportResultItem[] {
    const { transactions = [] } = reportParams
    return [
      h(2, 'DESCRIPTION OF SUSPICIOUS TRANSACTION'),
      ...transactions.flatMap(({ id, transaction }) => {
        const { productDetails = {}, transactionDetails = {} } = transaction
        return [
          h(3, `Transaction ${id}`),
          grid([
            [p('Product name'), textField(productDetails.productName)],
            [p('Type of product'), textField(productDetails.typeOfProduct)],
            [
              p('Current product value (RM)'),
              textField(productDetails.currentProductValueRm),
            ],
            [
              p('Date of product purchase'),
              textField(productDetails.dateOfProductPurchase),
            ],
            [
              p('Transaction amount (RM)'),
              textField(transactionDetails.transactionAmountRm),
            ],
            [
              p('Ranging transaction date'),
              textField(transactionDetails.rangingTransactionDate),
            ],
            [
              p('Transaction type'),
              textField(transactionDetails.transactionType),
            ],
            [
              p('Transaction method'),
              textField(transactionDetails.transactionMethod),
            ],
          ]),
        ]
      }),
    ]
  }
}
