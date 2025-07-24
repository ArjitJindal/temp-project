import { execSync } from 'child_process'
import * as fs from 'fs'
import path from 'path'
import os from 'os'
import * as Sentry from '@sentry/aws-serverless'
import { BadRequest } from 'http-errors'
import { XMLBuilder, XMLParser } from 'fast-xml-parser'
import { chunk, cloneDeep, isEqual, last, omit, pick } from 'lodash'
import SftpClient from 'ssh2-sftp-client'
import { GenerateResult, InternalReportType, ReportGenerator } from '../..'

import {
  ContactOffice,
  FilingInstitution,
  FinancialInstitutions,
  GeneralInfo,
  Subjects,
  SuspiciousActivity,
  SuspiciousActivityOtherInfo,
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
  PartySinglePartyName,
  phone,
  phoneByFax,
} from './helpers/prepopulating'
import { Report } from '@/@types/openapi-internal/Report'
import { Case } from '@/@types/openapi-internal/Case'
import { Account } from '@/@types/openapi-internal/Account'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { ReportParameters } from '@/@types/openapi-internal/ReportParameters'
import { ReportSchema } from '@/@types/openapi-internal/ReportSchema'
import dayjs from '@/utils/dayjs'
import {
  Party,
  SuspiciousActivityType,
} from '@/services/sar/generators/US/SAR/resources/EFL_SARXBatchSchema.type'
import { InternalBusinessUser } from '@/@types/openapi-internal/InternalBusinessUser'
import { InternalConsumerUser } from '@/@types/openapi-internal/InternalConsumerUser'
import { PaymentDetails } from '@/@types/tranasction/payment-type'
import { RuleHitDirection } from '@/@types/openapi-internal/RuleHitDirection'
import { getAllIpAddresses } from '@/utils/ipAddress'
import { envIs } from '@/utils/env'
import { logger } from '@/core/logger'
import { getSecretByName } from '@/utils/secrets-manager'
import { traceable } from '@/core/xray'
import {
  fixPartyIndicators,
  fixSuspiciousActivityIndicators,
} from '@/services/sar/generators/US/SAR/helpers/postprocessing'
import {
  ActivityPartyTypeCodes,
  FincenAcknowlegementDirectory,
  FincenSubmissionDirectory,
} from '@/services/sar/generators/US/SAR/helpers/constants'
import { CurrencyService } from '@/services/currency'
import { getDynamoDbClient } from '@/utils/dynamodb'
import { isValidSARRequest } from '@/utils/helpers'
import { connectToSFTP } from '@/utils/sar'

const FINCEN_BINARY = path.join(
  __dirname,
  'bin',
  os.platform() === 'darwin' ? 'fincen-amd64-darwin' : 'fincen-amd64-linux'
)
const VALIDATION_PREFIX = 'Error validating file: '
const attributesWithCorrectOrder = [
  '@ActivityCount',
  '@TotalAmount',
  '@PartyCount',
  '@ActivityAttachmentCount',
  '@AttachmentCount',
  '@xsi:schemaLocation',
  '@xmlns:xsi',
  '@xmlns:fc2',
  'fc2:FormTypeCode',
  'fc2:Activity',
]
function removeEmptyStringAndTrailingSpaces<T>(object: T): T {
  return JSON.parse(
    JSON.stringify(object, (k, v) => {
      if (typeof v === 'string') {
        if (v === '') {
          return undefined
        }
        return v.trim()
      }
      return v
    })
  )
}
function createNarrativeBlocks(narrative: string) {
  return chunk(narrative, 4000).map((c, i) => ({
    ActivityNarrativeSequenceNumber: `${i + 1}`,
    ActivityNarrativeText: c.join(''),
  }))
}

@traceable
export class UsSarReportGenerator implements ReportGenerator {
  public static getInstance(tenantId: string): UsSarReportGenerator {
    const generator = new UsSarReportGenerator()
    generator.setTenantId(tenantId)
    return generator
  }
  tenantId!: string
  getType(): InternalReportType {
    return {
      countryCode: 'US',
      type: 'SAR',
      directSubmission: true,
      subjectTypes: ['CASE'],
    }
  }
  public setTenantId(tenantId: string): void {
    this.tenantId = tenantId
  }
  public async getUserPopulatedParameters(): Promise<ReportParameters> {
    throw new Error(`User subject is not supported`)
  }
  public async getPopulatedParameters(
    c: Case,
    transactions: InternalTransaction[],
    reporter: Account
  ): Promise<ReportParameters> {
    const name = reporter.name
    const usersMap: Record<
      string,
      InternalConsumerUser | InternalBusinessUser
    > = {}
    const dynamoDb = getDynamoDbClient()
    const currencyService = new CurrencyService(dynamoDb)

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
          ? user?.contactDetails
          : user?.legalEntity?.contactDetails

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
          ActivityPartyTypeCode: ActivityPartyTypeCodes.SUBJECT,
          BirthDateUnknownIndicator: indicator(
            user.userDetails?.dateOfBirth == null
          ),
          IndividualBirthDateText: dateToDate(
            dayjs(user.userDetails?.dateOfBirth, 'YYYY-MM-DD').toDate()
          ),
          PartyName:
            user.userDetails && user.userDetails.name != null
              ? [partyNameByConsumerName(user.userDetails.name)]
              : undefined,
          FemaleGenderIndicator: indicator(user.userDetails?.gender === 'F'),
          MaleGenderIndicator: indicator(user.userDetails?.gender === 'M'),
          UnknownGenderIndicator: indicator(user.userDetails?.gender === 'NB'),
        })
      } else {
        subjects.push({
          ...sharedDetails,
          ActivityPartyTypeCode: ActivityPartyTypeCodes.SUBJECT,
          PartyName: user?.legalEntity?.companyGeneralDetails
            ? [
                partyNameByCompanyGeneralDetails(
                  user?.legalEntity?.companyGeneralDetails
                ),
              ]
            : [],
        })
      }
    }

    let startDate: any = undefined
    let endDate: any = undefined
    let totalAmount: any = undefined
    for (const transaction of transactions) {
      startDate = startDate
        ? Math.min(startDate, transaction.timestamp)
        : transaction.timestamp
      endDate = endDate
        ? Math.max(endDate, transaction.timestamp)
        : transaction.timestamp
      if (transaction.destinationAmountDetails != null) {
        const transactionAmount = await currencyService.getTargetCurrencyAmount(
          transaction.destinationAmountDetails,
          'USD'
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

    suspiciousActivity = {
      ...(suspiciousActivity ?? {}),
    } as SuspiciousActivityType

    const userIds: string[] = []
    if (c?.caseUsers?.origin?.userId) {
      userIds.push(c.caseUsers.origin.userId)
    }

    if (c?.caseUsers?.destination?.userId) {
      userIds.push(c.caseUsers.destination.userId)
    }

    const uniqueIPAddresses = await this.getIPAddresses(transactions)

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
    const financialInstitutions: PartySinglePartyName[] = []
    for (const { paymentDetails, directions } of uniquePaymentDetails) {
      const party = financialInstitutionByPaymentDetails(paymentDetails, {
        directions,
      })
      financialInstitutions.push({
        ...party,
      })
    }

    const params = {
      report: {
        generalInfo: {
          FilingDateText: dayjs().format('YYYYMMDD'),
          ActivitySupportDocument: undefined,
          ActivityAssociation: {
            InitialReportIndicator: 'Y',
          },
        },
        transmitter: {
          PartyName: {
            PartyNameTypeCode: 'L',
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
        otherInfo: { ActivityIPAddress: ActivityIPAddress },
      },
    }
    return params
  }

  public getSchema(): ReportSchema {
    return {
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
          otherInfo: SuspiciousActivityOtherInfo,
        },
        required: ['subjects', 'suspiciousActivity', 'financialInstitutions'],
        definitions: FincenJsonSchema.definitions,
      },
    }
  }

  private transform(reportParams: ReportParameters): object {
    // If EFilingPriorDocumentNumber passed, InitialReportIndicator should not be set
    if (reportParams.report.generalInfo?.EFilingPriorDocumentNumber) {
      const ActivityAssociation =
        reportParams.report.generalInfo.ActivityAssociation
      if (ActivityAssociation?.InitialReportIndicator === 'Y') {
        throw new Error(
          `When "Prior report BSA Identifier" provided, "Type of filing / Initial report" can not be set to true`
        )
      }

      if (
        ActivityAssociation.ContinuingActivityReportIndicator !== 'Y' &&
        ActivityAssociation.CorrectsAmendsPriorReportIndicator !== 'Y'
      ) {
        throw new Error(
          `When "Prior report BSA Identifier" provided, "Type of filing / Continuing activity report" or "Type of filing / Corrects/Amends prior report" must be set`
        )
      }
    }

    /**
     * Transmitter
     */
    // Augment ActivityPartyTypeCode
    reportParams.report.transmitter.ActivityPartyTypeCode =
      ActivityPartyTypeCodes.TRANSMITTER
    // Augment PartyNameTypeCode
    reportParams.report.transmitter.PartyName = [
      {
        ...reportParams.report.transmitter.PartyName,
        PartyNameTypeCode: 'L',
      },
    ]
    // Augment PartyIdentificationTypeCode
    const transmitterPartyIdentifications = [
      {
        PartyIdentificationNumberText: envIs('prod') ? 'PBSA8180' : 'TBSATEST',
        PartyIdentificationTypeCode: '28',
      },
      {
        ...reportParams.report.transmitter.FlagrightPartyIdentificationTin,
        PartyIdentificationTypeCode: '4',
      },
    ]
    reportParams.report.transmitter = omit(
      reportParams.report.transmitter,
      'FlagrightPartyIdentificationTin'
    )
    reportParams.report.transmitter.PartyIdentification =
      transmitterPartyIdentifications

    /**
     * Transmitter contact
     */
    // Augment ActivityPartyTypeCode
    reportParams.report.transmitterContact.ActivityPartyTypeCode =
      ActivityPartyTypeCodes.TRANSMITTER_CONTACT
    // Augment PartyNameTypeCode
    reportParams.report.transmitterContact.PartyName = [
      {
        ...reportParams.report.transmitterContact.PartyName,
        PartyNameTypeCode: 'L',
      },
    ]

    /**
     * Filing institution
     */
    // Augment ActivityPartyTypeCode
    reportParams.report.filingInstitution.ActivityPartyTypeCode =
      ActivityPartyTypeCodes.FILING_INSTITUTION
    // Augment PartyNameTypeCode
    reportParams.report.filingInstitution.PartyName = [
      {
        ...reportParams.report.filingInstitution.PartyName,
        PartyNameTypeCode: 'L',
      },
      reportParams.report.filingInstitution.AlternateName,
    ].filter(Boolean)
    // Augment PartyIdentificationTypeCode
    reportParams.report.filingInstitution.PartyIdentification = [
      reportParams.report.filingInstitution.FlagrightPartyIdentificationTin,
      reportParams.report.filingInstitution
        .FlagrightPartyIdentificationFilingInstitutionIdentification,
      reportParams.report.filingInstitution
        .FlagrightPartyIdentificationInternalControl
        ? {
            ...reportParams.report.filingInstitution
              .FlagrightPartyIdentificationInternalControl,
            PartyIdentificationTypeCode: '29',
          }
        : undefined,
    ].filter(Boolean)
    reportParams.report.filingInstitution = omit(
      reportParams.report.filingInstitution,
      'AlternateName',
      'FlagrightPartyIdentificationTin',
      'FlagrightPartyIdentificationFilingInstitutionIdentification',
      'FlagrightPartyIdentificationInternalControl'
    )

    /**
     * Contact office
     */
    // Augment ActivityPartyTypeCode
    reportParams.report.contactOffice.ActivityPartyTypeCode =
      ActivityPartyTypeCodes.CONTACT_OFFICE
    // Augment PartyNameTypeCode
    reportParams.report.contactOffice.PartyName = {
      ...reportParams.report.contactOffice.PartyName,
      PartyNameTypeCode: 'L',
    }

    /**
     * Financial Institution Where Activity Occurred
     */
    reportParams.transactionMetadata.financialInstitutions = (
      reportParams.transactionMetadata?.financialInstitutions ?? []
    ).map((financialInstitution: any) => {
      // Augment ActivityPartyTypeCode
      financialInstitution.ActivityPartyTypeCode =
        ActivityPartyTypeCodes.FINANCIAL_INSTITUTION
      // Augment PartyNameTypeCode
      financialInstitution.PartyName = [
        {
          ...(financialInstitution.PartyName[0] ??
            financialInstitution.PartyName),
          PartyNameTypeCode: 'L',
        },
        ...(financialInstitution.AlternateName ?? []),
      ]
      // Augment PartyIdentificationTypeCode
      financialInstitution.PartyIdentification = [
        financialInstitution.FlagrightPartyIdentificationTin
          .PartyIdentificationNumberText
          ? financialInstitution.FlagrightPartyIdentificationTin
          : {
              ...financialInstitution.FlagrightPartyIdentificationTin,
              TINUnknownIndicator: 'Y',
            },
        financialInstitution.FlagrightPartyIdentificationFinancialInstitutionIdentification,
        financialInstitution.FlagrightPartyIdentificationInternalControl
          ? {
              ...financialInstitution.FlagrightPartyIdentificationInternalControl,
              PartyIdentificationTypeCode: '29',
            }
          : undefined,
      ].filter(Boolean)
      return omit(
        financialInstitution,
        'AlternateName',
        'FlagrightPartyIdentificationTin',
        'FlagrightPartyIdentificationFinancialInstitutionIdentification',
        'FlagrightPartyIdentificationInternalControl'
      )
    })

    /**
     * Subjects
     */
    reportParams.transactionMetadata.subjects = (
      reportParams.transactionMetadata?.subjects ?? []
    ).map((subject: any) => {
      // Augment ActivityPartyTypeCode
      subject.ActivityPartyTypeCode = ActivityPartyTypeCodes.SUBJECT
      // Augment PartyNameTypeCode
      subject.PartyName = [
        subject.PartyName
          ? {
              ...(subject.PartyName[0] ?? subject.PartyName),
              PartyNameTypeCode: 'L',
            }
          : undefined,
        ...(subject.AlternateName ?? []),
      ].filter(Boolean)
      const validPartyIdentification = [
        subject.FlagrightPartyIdentificationTin.PartyIdentificationNumberText
          ? subject.FlagrightPartyIdentificationTin
          : {
              ...subject.FlagrightPartyIdentificationTin,
              TINUnknownIndicator: 'Y',
            },
      ]
      subject.PartyIdentification?.forEach((partyIdentification) => {
        if (
          partyIdentification.PartyIdentificationTypeCode &&
          partyIdentification.PartyIdentificationNumberText
        ) {
          validPartyIdentification.push(partyIdentification)
        }
      })
      subject.PartyIdentification = validPartyIdentification
      return omit(subject, 'AlternateName', 'FlagrightPartyIdentificationTin')
    })

    const parties = [
      reportParams.report.transmitter,
      reportParams.report.transmitterContact,
      reportParams.report.filingInstitution,
      reportParams.report.contactOffice,
      ...(reportParams.transactionMetadata?.subjects ?? []),
      ...(reportParams.transactionMetadata?.financialInstitutions ?? []),
    ].map(fixPartyIndicators)

    // Autofilling ActivityNarrativeSequenceNumber
    reportParams.report.generalInfo.ActivityNarrativeInformation =
      createNarrativeBlocks(
        reportParams.report?.generalInfo?.ActivityNarrativeInformation
          ?.ActivityNarrativeText
      )

    const suspiciousActivity = fixSuspiciousActivityIndicators(
      reportParams.transactionMetadata?.suspiciousActivity
    )

    return removeEmptyStringAndTrailingSpaces({
      EFilingBatchXML: {
        Activity: {
          Party: parties,
          SuspiciousActivity: suspiciousActivity,
          ...reportParams.report.generalInfo,
          EFilingPriorDocumentNumber: reportParams?.report?.generalInfo
            ?.EFilingPriorDocumentNumber
            ? parseInt(
                reportParams.report.generalInfo.EFilingPriorDocumentNumber
              )
                .toString()
                .padStart(14, '0')
            : undefined,
          ...reportParams.transactionMetadata.otherInfo,
        },
        FormTypeCode: 'SARX',
      },
    })
  }
  public getAugmentedReportParams(report: Report): ReportParameters {
    const reportParams = report.parameters
    const attachments = report.attachments
    const fileName =
      attachments && attachments.length ? attachments[0].filename : ''
    const constructedReportParams: ReportParameters = {
      ...reportParams,
      report: {
        ...reportParams.report,
        generalInfo: {
          ...reportParams.report.generalInfo,
          ActivitySupportDocument: {
            OriginalAttachmentFileName: fileName,
          },
        },
      },
    }
    return constructedReportParams
  }
  public async generate(
    reportParams: ReportParameters
  ): Promise<GenerateResult> {
    const builder = new XMLBuilder({
      attributeNamePrefix: '@',
      ignoreAttributes: false,
    })
    const xmlContent = builder.build(this.transform(cloneDeep(reportParams)))
    // NOTE: In aws lambda, we can only write files to /tmp
    const outputFile = `${path.join('/tmp', 'input.xml')}`

    fs.writeFileSync(outputFile, xmlContent)

    // Reformat and add generated attributes
    const reformatOutput = this.callFinCenBinary(
      'reformat',
      '--generate-attrs',
      outputFile
    )
    const startIndex = reformatOutput.indexOf('<fc2')
    if (startIndex === -1) {
      throw new BadRequest(reformatOutput)
    }
    const finalFileContent = reformatOutput.slice(startIndex)
    fs.writeFileSync(outputFile, finalFileContent)

    const parser = new XMLParser({
      attributeNamePrefix: '@',
      ignoreAttributes: false,
      parseAttributeValue: true,
      parseTagValue: false,
      numberParseOptions: {
        hex: false,
        leadingZeros: true,
      },
    })
    const xmlJson = parser.parse(finalFileContent)
    xmlJson['fc2:EFilingBatchXML']['@ActivityAttachmentCount'] = '0'
    xmlJson['fc2:EFilingBatchXML']['@AttachmentCount'] = 0
    xmlJson['fc2:EFilingBatchXML'] = pick(
      xmlJson['fc2:EFilingBatchXML'],
      ...attributesWithCorrectOrder
    )
    const newXmlBuilder = new XMLBuilder({
      attributeNamePrefix: '@',
      ignoreAttributes: false,
      format: true,
    })
    const newXmlFile = newXmlBuilder.build(xmlJson)
    fs.writeFileSync(outputFile, newXmlFile)
    try {
      this.callFinCenBinary('validate', outputFile)
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : ''
      const validationIndex = errorMsg.indexOf(VALIDATION_PREFIX)
      throw new BadRequest(
        errorMsg.slice(validationIndex).replace(VALIDATION_PREFIX, '')
      )
    }
    fs.rmSync(outputFile)
    return {
      type: 'STRING',
      value: newXmlFile,
    }
  }

  private callFinCenBinary(...args: string[]): string {
    const command = [FINCEN_BINARY, ...args].join(' ')

    try {
      const result = execSync(command, {
        cwd: __dirname,
      })
      return result.toString()
    } catch (e) {
      logger.error(`Unable to execute command: ${command}`)
      const errorMsg = (e as any).stdout.toString()
      throw new Error(errorMsg)
    }
  }

  public async getIPAddresses(transactions: InternalTransaction[]) {
    const IPAddressesByTransactions = transactions
      .filter(
        (transaction) =>
          transaction?.originDeviceData?.ipAddress ??
          transaction.destinationDeviceData?.ipAddress
      )
      .map((transaction) => getAllIpAddresses(transaction))
      .flat()

    const uniqueIPAddresses = new Set([...IPAddressesByTransactions])
    return [...uniqueIPAddresses]
  }

  public async getAckFileContent(
    sftp: SftpClient,
    report: Report,
    creds: { username: string }
  ) {
    if (isValidSARRequest(this.tenantId)) {
      const remoteCwd = await sftp.cwd()
      const ackDir = remoteCwd + FincenAcknowlegementDirectory
      const submissionDir = remoteCwd + FincenSubmissionDirectory
      const reportType = report.reportTypeId.split('-')[1]
      if (reportType !== 'SAR' && reportType !== 'CTR') {
        await sftp.end()
        return undefined
      }
      const submittedRemoteFilename = `${reportType}XST.${dayjs(
        report.createdAt
      ).format('YYYYMMDDhhmmss')}.${creds.username}.xml`
      const remoteFilename = `${reportType}XST.${dayjs(report.createdAt).format(
        'YYYYMMDDhhmmss'
      )}.${creds.username}.xml.MESSAGES.XML`
      // check if submitted file exists in submission directory
      const existsInSubmission = await sftp.exists(
        path.join(submissionDir, submittedRemoteFilename)
      )
      if (existsInSubmission) {
        // fincen has not yet processed the report, no need to check ack dir
        return ''
      }
      const localAckFile = `${path.join('/tmp', `${remoteFilename}-ack`)}`
      const exists = await sftp.exists(path.join(ackDir, remoteFilename))
      if (!exists) {
        await sftp.end()
        return undefined
      }
      await sftp.fastGet(path.join(ackDir, remoteFilename), localAckFile)
      const ackFileContent = fs.readFileSync(localAckFile, 'utf8')
      return ackFileContent
    }
  }

  public async submit(report: Report) {
    if (isValidSARRequest(this.tenantId)) {
      const creds = await getSecretByName('fincenCreds')
      const sftp = await connectToSFTP()
      const remoteCwd = await sftp.cwd()
      const submissionsDir = remoteCwd + FincenSubmissionDirectory
      const remoteFilename = `SARXST.${dayjs(report.createdAt).format(
        'YYYYMMDDhhmmss'
      )}.${creds.username}.xml`
      const localFilePath = `${path.join('/tmp', `${report.id}.xml`)}`
      fs.writeFileSync(localFilePath, last(report.revisions)?.output ?? '')

      // uploading file to sftp
      await sftp.fastPut(
        localFilePath,
        path.join(submissionsDir, remoteFilename)
      )
      await sftp.end()
    }

    Sentry.withScope((scope) => {
      scope.setTags({ reportId: report.id })
      scope.setFingerprint([this.tenantId, report.id ?? ''])
      Sentry.captureMessage(`[${report.id}] New FinCEN SAR report submitted`)
    })
    return '' // todo update this
  }
}
