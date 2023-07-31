import { execSync } from 'child_process'
import * as fs from 'fs'
import path from 'path'
import os from 'os'
import { BadRequest } from 'http-errors'
import { XMLBuilder } from 'fast-xml-parser'
import { InternalReportType, PopulatedSchema, ReportGenerator } from '../..'
import {
  ContactOffice,
  FilingInstitution,
  FinancialInstitution,
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
  partyNameByCompanyGeneralDetails,
  partyNameByConsumerName,
  dateToDate,
  electronicAddressByEmail,
  phoneByFax,
  indicator,
  phone,
  electronicAddressByWebsite,
} from './helpers/prepopulating'
import { Case } from '@/@types/openapi-internal/Case'
import { Account } from '@/@types/openapi-internal/Account'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { ReportParameters } from '@/@types/openapi-internal/ReportParameters'
import { ReportSchema } from '@/@types/openapi-internal/ReportSchema'
import {
  Party,
  SuspiciousActivityType,
} from '@/services/sar/generators/US/SAR/resources/EFL_SARXBatchSchema.type'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import dayjs from '@/utils/dayjs'
import { getTargetCurrencyAmount } from '@/utils/currency-utils'

const FINCEN_BINARY = path.join(
  __dirname,
  'bin',
  os.platform() === 'darwin' ? 'fincen-amd64-darwin' : 'fincen-amd64-linux'
)
const VALIDATION_PREFIX = 'Error validating file: '

export class UsSarReportGenerator implements ReportGenerator {
  getType(): InternalReportType {
    return {
      countryCode: 'US',
      type: 'SAR',
    }
  }

  public async getPopulatedSchema(
    _reportId: string,
    _c: Case,
    transactions: InternalTransaction[],
    _reporter: Account
  ): Promise<PopulatedSchema> {
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
      // todo: what is the difference between CumulativeTotalViolationAmountText and TotalSuspiciousAmountText
      suspiciousActivity = {
        CumulativeTotalViolationAmountText: totalAmount
          ? amount(totalAmount)
          : undefined,
        TotalSuspiciousAmountText: totalAmount
          ? amount(totalAmount)
          : undefined,
        NoAmountInvolvedIndicator: indicator(totalAmount == null),
        SuspiciousActivityFromDateText: dateToDate(new Date(startDate)),
        SuspiciousActivityToDateText: dateToDate(new Date(endDate)),
      }
    }

    const params = {
      report: {},
      transactions: transactions?.map((t) => {
        return { id: t.transactionId, transaction: {} }
      }),
      indicators: [],
      transactionMetadata: {
        subjects,
        suspiciousActivity,
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
          finantialInstitution: FinancialInstitution,
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
}
