import { execSync } from 'child_process'
import * as fs from 'fs'
import path from 'path'
import os from 'os'
import { BadRequest } from 'http-errors'
import { XMLBuilder } from 'fast-xml-parser'
import { isEqual } from 'lodash'
import { InternalReportType, PopulatedSchema, ReportGenerator } from '../..'
import {
  ContactOffice,
  FilingInstitution,
  FinancialInstitutions,
  GeneralInfo,
  Subjects,
  SuspiciousActivity,
  Transmitter,
  TransmitterContact,
} from './schema'
import { FincenJsonSchema } from './resources/EFL_SARXBatchSchema'
import {
  address,
  amount,
  dateToDate,
  electronicAddressByEmail,
  electronicAddressByWebsite,
  financialInstitutionByPaymentDetails,
  indicator,
  partyNameByCompanyGeneralDetails,
  partyNameByConsumerName,
  phone,
  phoneByFax,
} from './helpers/prepopulating'
import { Case } from '@/@types/openapi-internal/Case'
import { Account } from '@/@types/openapi-internal/Account'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { ReportParameters } from '@/@types/openapi-internal/ReportParameters'
import { ReportSchema } from '@/@types/openapi-internal/ReportSchema'
import dayjs from '@/utils/dayjs'
import { getMongoDbClient } from '@/utils/mongoDBUtils'
import { MetricsRepository } from '@/services/rules-engine/repositories/metrics'
import {
  Party,
  SuspiciousActivityType,
} from '@/services/sar/generators/US/SAR/resources/EFL_SARXBatchSchema.type'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { getTargetCurrencyAmount } from '@/utils/currency-utils'
import { PaymentDetails } from '@/@types/tranasction/payment-type'
import { RuleHitDirection } from '@/@types/openapi-internal/RuleHitDirection'

const FINCEN_BINARY = path.join(
  __dirname,
  'bin',
  os.platform() === 'darwin' ? 'fincen-amd64-darwin' : 'fincen-amd64-linux'
)
const VALIDATION_PREFIX = 'Error validating file: '

export class UsSarReportGenerator implements ReportGenerator {
  tenantId!: string
  getType(): InternalReportType {
    return {
      countryCode: 'US',
      type: 'SAR',
    }
  }

  public async getPopulatedSchema(
    _reportId: string,
    c: Case,
    transactions: InternalTransaction[],
    reporter: Account
  ): Promise<PopulatedSchema> {
    const name = reporter.name
    const usersMap: Record<
      string,
      InternalConsumerUser | InternalBusinessUser
    > = {}
    for (const transaction of transactions) {
      if (transaction.originUser != null) {
        usersMap[transaction.originUser.userId] = transaction.originUser
      }
      if (transaction.destinationUser != null) {
        usersMap[transaction.destinationUser.userId] =
          transaction.destinationUser
      }
    }
    const users: (InternalConsumerUser | InternalBusinessUser)[] =
      Object.values(usersMap)

    const subjects: Party[] = []
    for (const user of users) {
      const contactDetails =
        user.type === 'CONSUMER'
          ? user.contactDetails
          : user.legalEntity.contactDetails

      const sharedDetails: Partial<Party> = {
        Address: contactDetails?.addresses?.map(address),
        PhoneNumber: [
          ...(contactDetails?.contactNumbers?.map(phone) ?? []),
          ...(contactDetails?.faxNumbers?.map(phoneByFax) ?? []),
        ],
        ElectronicAddress: [
          ...(contactDetails?.emailIds?.map(electronicAddressByEmail) ?? []),
          ...(contactDetails?.websites?.map(electronicAddressByWebsite) ?? []),
        ],
      }

      if (user.type === 'CONSUMER') {
        subjects.push({
          ...sharedDetails,
          ActivityPartyTypeCode: '33',
          BirthDateUnknownIndicator: indicator(
            user.userDetails?.dateOfBirth == null
          ),
          IndividualBirthDateText: dateToDate(
            dayjs(user.userDetails?.dateOfBirth, 'YYYY-MM-DD').toDate()
          ),
          PartyName:
            user.userDetails != null
              ? [partyNameByConsumerName(user.userDetails.name)]
              : undefined,
          FemaleGenderIndicator: indicator(user.userDetails?.gender === 'F'),
          MaleGenderIndicator: indicator(user.userDetails?.gender === 'M'),
          UnknownGenderIndicator: indicator(user.userDetails?.gender === 'NB'),
        })
      } else {
        subjects.push({
          ...sharedDetails,
          ActivityPartyTypeCode: '33',
          PartyName: [
            partyNameByCompanyGeneralDetails(
              user.legalEntity.companyGeneralDetails
            ),
          ],
        })
      }
    }

    let startDate = undefined
    let endDate = undefined
    let totalAmount = undefined
    for (const transaction of transactions) {
      startDate = startDate
        ? Math.min(startDate, transaction.timestamp)
        : transaction.timestamp
      endDate = endDate
        ? Math.max(endDate, transaction.timestamp)
        : transaction.timestamp
      if (transaction.destinationAmountDetails != null) {
        const transactionAmount = await getTargetCurrencyAmount(
          transaction.destinationAmountDetails,
          'USD',
          new Date(transaction.timestamp)
        )
        totalAmount = (totalAmount ?? 0) + transactionAmount.transactionAmount
      }
    }
    let suspiciousActivity: SuspiciousActivityType | undefined = undefined
    if (startDate != null && endDate != null) {
      suspiciousActivity = {
        CumulativeTotalViolationAmountText: undefined,
        TotalSuspiciousAmountText: totalAmount
          ? amount(totalAmount)
          : undefined,
        NoAmountInvolvedIndicator: indicator(totalAmount == null),
        SuspiciousActivityFromDateText: dateToDate(new Date(startDate)),
        SuspiciousActivityToDateText: dateToDate(new Date(endDate)),
      }
    }
    const userIds: string[] = []
    if (c?.caseUsers?.origin?.userId) {
      userIds.push(c.caseUsers.origin.userId)
    }

    if (c?.caseUsers?.destination?.userId) {
      userIds.push(c.caseUsers.destination.userId)
    }

    const uniqueIPAddresses = await this.getIPAddresses(userIds, transactions)

    const ActivityIPAddress = uniqueIPAddresses.map((ipAddress) => {
      return {
        IPAddressText: ipAddress,
      }
    })

    const uniquePaymentDetails: {
      paymentDetails: PaymentDetails
      directions: RuleHitDirection[]
    }[] = []
    for (const transaction of transactions) {
      const toCheck = [
        [transaction.originPaymentDetails, 'ORIGIN' as const],
        [transaction.destinationPaymentDetails, 'DESTINATION' as const],
      ] as const
      for (const [paymentDetails, direction] of toCheck) {
        if (paymentDetails != null) {
          const item = uniquePaymentDetails.find((x) =>
            isEqual(x.paymentDetails, paymentDetails)
          )
          if (item != null) {
            item.directions.push(direction)
          } else {
            uniquePaymentDetails.push({
              paymentDetails,
              directions: [direction],
            })
          }
        }
      }
    }
    const financialInstitutions: Party[] = []
    for (const { paymentDetails, directions } of uniquePaymentDetails) {
      const party = financialInstitutionByPaymentDetails(paymentDetails, {
        directions,
      })
      if ((party.PartyName?.length ?? 0) > 0) {
        financialInstitutions.push(party)
      }
    }

    const params = {
      report: {
        generalInfo: {
          FilingDateText: dayjs().format('YYYYMMDD'),
          ActivityIPAddress: ActivityIPAddress,
        },
        transmitter: {
          PartyName: {
            RawPartyFullName: name,
          },
        },
      },
      transactions: transactions?.map((t) => {
        return { id: t.transactionId, transaction: {} }
      }),
      indicators: [],
      transactionMetadata: {
        subjects,
        suspiciousActivity,
        financialInstitutions,
      },
    }
    const schema: ReportSchema = {
      reportSchema: {
        type: 'object',
        properties: {
          generalInfo: GeneralInfo,
          transmitter: Transmitter,
          transmitterContact: TransmitterContact,
          filingInstitution: FilingInstitution,
          contactOffice: ContactOffice,
        },
        required: [
          'generalInfo',
          'transmitter',
          'transmitterContact',
          'filingInstitution',
          'contactOffice',
        ],
        definitions: FincenJsonSchema.definitions,
      },
      transactionMetadataSchema: {
        type: 'object',
        properties: {
          subjects: Subjects,
          suspiciousActivity: SuspiciousActivity,
          financialInstitutions: FinancialInstitutions,
        },
        required: ['subjects', 'suspiciousActivity', 'finantialInstitution'],
        definitions: FincenJsonSchema.definitions,
      },
    }
    return {
      params,
      schema,
    }
  }

  public generate(reportParams: ReportParameters): string {
    const builder = new XMLBuilder({
      attributeNamePrefix: '@',
      ignoreAttributes: false,
    })

    // Augment parties with ActivityPartyTypeCode
    // TODO: Augment PartyNameTypeCode, PartyIdentificationTypeCode
    const parties = [
      [reportParams.report.transmitter, 35],
      [reportParams.report.transmitterContact, 37],
      [reportParams.report.filingInstitution, 30],
      [reportParams.report.contactOffice, 8],
      [reportParams.report.finantialInstitution, 34],
      ...(reportParams.transactionMetadata?.subjects ?? []).map((s: any) => [
        s,
        33,
      ]),
      ...(reportParams.transactionMetadata?.financialInstitutions ?? []).map(
        (s: any) => [s, 34]
      ),
    ].map(([party, typeCode]) => ({
      ...party,
      ActivityPartyTypeCode: typeCode,
    }))

    const fincenJson = {
      EFilingBatchXML: {
        Activity: {
          Party: parties,
          SuspiciousActivity:
            reportParams.transactionMetadata?.suspiciousActivity,
          ...reportParams.report.generalInfo,
        },
        FormTypeCode: 'SARX',
      },
    }

    // TODO: handle attachments: ActivitySupportDocument
    const xmlContent = builder.build(fincenJson)
    // NOTE: In aws lambda, we can only write files to /tmp
    const outputFile = `${path.join('/tmp', 'input.xml')}`
    fs.writeFileSync(outputFile, xmlContent)

    // Reformat and add generated attributes
    const reformatOutput = execSync(
      `${FINCEN_BINARY} reformat --generate-attrs ${outputFile}`,
      {
        cwd: __dirname,
      }
    ).toString()
    const startIndex = reformatOutput.indexOf('<fc2')
    if (startIndex === -1) {
      throw new BadRequest(reformatOutput)
    }
    const finalFileContent = reformatOutput.slice(startIndex)
    fs.writeFileSync(outputFile, finalFileContent)

    // Validate the final file
    try {
      execSync(`${FINCEN_BINARY} validate ${outputFile}`, {
        cwd: __dirname,
      })
    } catch (e) {
      const errorMsg = (e as any).stdout.toString()
      const validationIndex = errorMsg.indexOf(VALIDATION_PREFIX)
      throw new BadRequest(
        errorMsg.slice(validationIndex).replace(VALIDATION_PREFIX, '')
      )
    }
    fs.rmSync(outputFile)
    return finalFileContent
  }
  public async getIPAddresses(
    userIds: string[],
    transactions: InternalTransaction[]
  ) {
    const mongoDb = await getMongoDbClient()
    const metricsRepository = new MetricsRepository(this.tenantId, { mongoDb })

    const transactionIds = transactions.map(
      (transaction) => transaction.transactionId
    )

    const deviceData = await metricsRepository.getMetricsById(
      userIds,
      transactionIds
    )
    const IPAddressesByUser = deviceData
      ? deviceData.map((data) => data.ipAddress).filter(Boolean)
      : []

    const IPAddressesByTransactions = transactions
      .filter((transaction) => transaction.deviceData?.ipAddress)
      .map((transaction) => transaction.deviceData?.ipAddress)
    const uniqueIPAddresses = new Set([
      ...IPAddressesByUser,
      ...IPAddressesByTransactions,
    ])
    return [...uniqueIPAddresses]
  }
}
