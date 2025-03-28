import path from 'path'
import fs from 'fs'
import os from 'os'
import { execSync } from 'child_process'
import { XMLBuilder } from 'fast-xml-parser'
import { cloneDeep, last } from 'lodash'
import { BadRequest } from 'http-errors'
import * as Sentry from '@sentry/serverless'
import { GenerateResult, InternalReportType, ReportGenerator } from '../..'
import {
  ActivityPartyTypeCodesCTR,
  FincenSubmissionDirectory,
} from '../SAR/helpers/constants'
import {
  ContactOffice,
  CurrencyTransactionActivity,
  PersonsInvolvedInTransactions,
  FilingInstitution,
  TransactionLocations,
  Transmitter,
  TransmitterContact,
} from './schema'
import { FincenJsonSchema } from './resources/EFL_CTRXBatchSchema'
import { ReportParameters } from '@/@types/openapi-internal/ReportParameters'
import { ReportSchema } from '@/@types/openapi-internal/ReportSchema'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { Account } from '@/@types/openapi-internal/Account'
import { Case } from '@/@types/openapi-internal/Case'
import dayjs from '@/utils/dayjs'
import { envIs } from '@/utils/env'
import { logger } from '@/core/logger'
import { Report } from '@/@types/openapi-internal/Report'
import { isValidSARRequest } from '@/utils/helpers'
import { getSecretByName } from '@/utils/secrets-manager'
import { connectToSFTP } from '@/utils/sar'

const FINCEN_BINARY = path.join(
  __dirname,
  '../SAR/bin',
  os.platform() === 'darwin' ? 'fincen-amd64-darwin' : 'fincen-amd64-linux'
)
const VALIDATION_PREFIX = 'Error validating file: '

export class UsCtrReportGenerator implements ReportGenerator {
  public static getInstance(tenantId: string): UsCtrReportGenerator {
    const generator = new UsCtrReportGenerator()
    generator.setTenantId(tenantId)
    return generator
  }
  tenantId!: string
  getType(): InternalReportType {
    return {
      countryCode: 'US',
      type: 'CTR',
      directSubmission: false,
      subjectTypes: ['CASE'],
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

  private transform(reportParams: ReportParameters): object {
    // transforming schema based on https://bsaefiling.fincen.treas.gov/docs/XMLUserGuide_FinCENCTR.pdf

    // All properties of a party
    // [
    //         'ActivityPartyTypeCode',
    //         'BirthDateUnknownIndicator',
    //         'EFilingCoverageBeginningDateText',
    //         'EFilingCoverageEndDateText',
    //         'FemaleGenderIndicator',
    //         'IndividualBirthDateText',
    //         'IndividualEntityCashInAmountText',
    //         'IndividualEntityCashOutAmountText',
    //         'MaleGenderIndicator',
    //         'MultipleTransactionsPersonsIndividualsIndicator',
    //         'PartyAsEntityOrganizationIndicator',
    //         'PrimaryRegulatorTypeCode',
    //         'UnknownGenderIndicator',
    //         'PartyName',
    //         'Address',
    //         'PhoneNumber',
    //         'PartyIdentification',
    //         'OrganizationClassificationTypeSubtype',
    //         'PartyOccupationBusiness',
    //         'ElectronicAddress',
    //         'Account',
    //       ],

    /**
     * Search 35 = Transmitter in pdf
     * Transmitter
     */
    const transmitter = {
      ActivityPartyTypeCode: ActivityPartyTypeCodesCTR.TRANSMITTER,
      EFilingCoverageBeginningDateText: '20020612', //TODO: calculate
      EFilingCoverageEndDateText: '20020612', // TODO: calculate
      PartyName: [
        {
          ...reportParams.report.transmitter.TransmitterName,
          PartyNameTypeCode: 'L',
        },
      ],
      Address: reportParams.report.transmitter.TransmitterAddress,
      PhoneNumber: reportParams.report.transmitter.TransmitterTelephoneNumber, // no extentsion
      PartyIdentification: [
        {
          ...reportParams.report.transmitter.TransmitterTin,
          PartyIdentificationTypeCode: '4',
        },
        {
          PartyIdentificationNumberText: envIs('prod')
            ? 'PBSA8180'
            : 'TBSATEST',
          PartyIdentificationTypeCode: '28',
        },
      ],
    }

    /**
     * Search 35 = Transmitter in pdf
     * Transmitter
     */
    const transmitterContact = {
      ActivityPartyTypeCode: ActivityPartyTypeCodesCTR.TRANSMITTER_CONTACT,
      EFilingCoverageBeginningDateText: '20020612', //TODO: calculate
      EFilingCoverageEndDateText: '20020612', // TODO: calculate
      PartyName: reportParams.report.transmitterContact.PartyName,
    }

    const reportingFinancialInstitution = {
      ActivityPartyTypeCode: ActivityPartyTypeCodesCTR.FILING_INSTITUTION,
      PartyName: [
        {
          ...reportParams.report.filingInstitution.InstitutionName,
          PartyNameTypeCode: 'L',
        },
        reportParams.report.filingInstitution.InstitutionAlternateName,
      ],
      Address: reportParams.report.filingInstitution.Address,
      PartyIdentification: [
        {
          ...reportParams.report.filingInstitution.InstituionEin,
          PrimaryRegulatorTypeCode: '2',
        },
        // only add when type code is not unknown
        reportParams.report.filingInstitution.InstituionEin
          .PrimaryRegulatorTypeCode !== '14' &&
          reportParams.report.filingInstitution
            .FinancialInstitutionIdentification,
      ],
      OrganizationClassificationTypeSubtype:
        reportParams.report.filingInstitution.InstituteTypeSubType,
    }

    const assistanceContact = {
      ActivityPartyTypeCode: ActivityPartyTypeCodesCTR.ASSISTANCE_CONTACT,
      PartyName: {
        ...reportParams.report.contactOffice.ContactOfficeName,
        PartyNameTypeCode: 'L',
      },
      PhoneNumber: reportParams.report.contactOffice.PhoneNumber,
    }

    const transactionLocations =
      // check for location code
      reportParams.currencyTransaction.transactionLocations.map((location) => ({
        ActivityPartyTypeCode: ActivityPartyTypeCodesCTR.TRANSMITTER_LOCATION,
        IndividualEntityCashInAmountText: '10000', // TODO calculate
        IndividualEntityCashOutAmountText: '10000', // TODO calculate
        PrimaryRegulatorTypeCode:
          location.FederalRegulator.PartyIdentificationTypeCode,
        PartyName: [
          { ...location.LegalName, PartyNameTypeCode: 'L' },
          location.AlternateName,
        ],
        Address: location.Address,
        PartyIdentification: [
          {
            PartyIdentificationTypeCode: '2',
            ...(location.EIN && location.EIN.PartyIdentificationNumberText
              ? {
                  PartyIdentificationNumberText:
                    location.EIN.PartyIdentificationNumberText,
                }
              : { TINUnknownIndicator: 'Y' }),
          },
          location.FinancialInstitutionID,
        ],
        OrganizationClassificationTypeSubtype: location.InstituteTypeSubType,
      }))

    const PersonInvolvedInTransaction = (entityName: string, code: string) => {
      if (!reportParams.currencyTransaction.personsInvolvedInTransactions) {
        return undefined
      }
      const person =
        reportParams.currencyTransaction.personsInvolvedInTransactions[
          entityName
        ]

      if (!person) {
        return undefined
      }

      return {
        ...person,
        ActivityPartyTypeCode: code,
        PartyName: [
          {
            PartyNameTypeCode: 'L',
            ...(person.PartyName.RawIndividualFirstName
              ? {
                  RawIndividualFirstName:
                    person.PartyName.RawIndividualFirstName,
                }
              : { FirstNameUnknownIndicator: 'Y' }),
            ...(person.PartyName.RawEntityIndividualLastName
              ? {
                  RawEntityIndividualLastName:
                    person.PartyName.RawEntityIndividualLastName,
                }
              : { EntityLastNameUnknownIndicator: 'Y' }),
            ...(person.PartyName.RawIndividualMiddleName && {
              RawIndividualMiddleName: person.PartyName.RawIndividualMiddleName,
            }),
            ...(person.PartyName.RawIndividualNameSuffixText && {
              RawIndividualNameSuffixText:
                person.PartyName.RawIndividualNameSuffixText,
            }),
          },
          {
            ...(person.AlertnatePartyName &&
              person.AlertnatePartyName.PartyNameTypeCode && {
                PartyNameTypeCode: person.AlertnatePartyName.PartyNameTypeCode,
                ...(person.AlertnatePartyName.RawIndividualFirstName
                  ? {
                      RawIndividualFirstName:
                        person.AlertnatePartyName.RawIndividualFirstName,
                    }
                  : { FirstNameUnknownIndicator: 'Y' }),
                ...(person.AlertnatePartyName.RawEntityIndividualLastName
                  ? {
                      RawEntityIndividualLastName:
                        person.AlertnatePartyName.RawEntityIndividualLastName,
                    }
                  : { EntityLastNameUnknownIndicator: 'Y' }),
                ...(person.AlertnatePartyName.RawIndividualMiddleName && {
                  RawIndividualMiddleName:
                    person.AlertnatePartyName.RawIndividualMiddleName,
                }),
                ...(person.AlertnatePartyName.RawIndividualNameSuffixText && {
                  RawIndividualNameSuffixText:
                    person.AlertnatePartyName.RawIndividualNameSuffixText,
                }),
              }),
          },
        ],
        ...(person.IndividualBirthDateText
          ? {
              IndividualBirthDateText: person.IndividualBirthDateText,
            }
          : { BirthDateUnknownIndicator: 'Y' }),
        Address: {
          ...(person.Address && person.Address.RawCityText
            ? { RawCityText: person.Address.RawCityText }
            : { CityUnknownIndicator: 'Y' }),

          ...(person.Address && person.Address.RawCountryCodeText
            ? { RawCountryCodeText: person.Address.RawCountryCodeText }
            : { CountryCodeUnknownIndicator: 'Y' }),

          ...(person.Address && person.Address.RawStateCodeText
            ? { RawStateCodeText: person.Address.RawStateCodeText }
            : { StateCodeUnknownIndicator: 'Y' }),

          ...(person.Address && person.Address.RawStreetAddress1Text
            ? { RawStreetAddress1Text: person.Address.RawStreetAddress1Text }
            : { StreetAddressUnknownIndicator: 'Y' }),

          ...(person.Address && person.Address.RawZIPCode
            ? { RawZIPCode: person.Address.RawZIPCode }
            : { ZIPCodeUnknownIndicator: 'Y' }),
        },
        ...(person.PhoneNumber &&
          person.PhoneNumber.PhoneNumberText && {
            PhoneNumber: person.PhoneNumber,
          }),
        PartyIdentification: [
          {
            ...(person.TIN ? person.TIN : { TINUnknownIndicator: 'Y' }),
          },
          {
            ...(person.formOfIndentification &&
            (person.formOfIndentification.PartyIdentificationTypeCode ||
              person.formOfIndentification.PartyIdentificationNumberText)
              ? person.formOfIndentification
              : { IdentificationPresentUnknownIndicator: 'Y' }),
          },
        ],
      }
    }

    const PersonConductingTransactionOnOwnBehalf = PersonInvolvedInTransaction(
      'PersonConductingTransactionOnOwnBehalf',
      ActivityPartyTypeCodesCTR.PERSON_TXN_ON_OWN_BEHALF
    )

    const PersonConductingTransactionForAnother = PersonInvolvedInTransaction(
      'PersonConductingTransactionForAnother',
      ActivityPartyTypeCodesCTR.PERSON_TXN_FOR_ANOTHER
    )

    const PersonOnWhoseBehalfThisTransactionWasConducted =
      PersonInvolvedInTransaction(
        'PersonOnWhoseBehalfThisTransactionWasConducted',
        ActivityPartyTypeCodesCTR.PERSON_TXN_BEHALF
      )

    const CommonCarrier = PersonInvolvedInTransaction(
      'CommonCarrier',
      ActivityPartyTypeCodesCTR.COMMON_CARRIER
    )

    const CurrencyTransactionActivity = {
      ...reportParams.currencyTransaction.currencyTransactionActivity,
      AggregateTransactionIndicator: reportParams.currencyTransaction
        .AggregateTransactionIndicator
        ? 'Y'
        : '',
      ArmoredCarServiceIndicator: reportParams.currencyTransaction
        .ArmoredCarServiceIndicator
        ? 'Y'
        : '',
      ATMIndicator: reportParams.currencyTransaction.ATMIndicator ? 'Y' : '',
      MailDepositShipmentIndicator: reportParams.currencyTransaction
        .MailDepositShipmentIndicator
        ? 'Y'
        : '',
      NightDepositIndicator: reportParams.currencyTransaction
        .NightDepositIndicator
        ? 'Y'
        : '',
      SharedBranchingIndicator: reportParams.currencyTransaction
        .SharedBranchingIndicator
        ? 'Y'
        : '',
    }

    return {
      EFilingBatchXML: {
        Activity: {
          /**
           Scenario 1. The FinCEN CTR amends a prior report where the BSA ID is known:
           <fc2:EFilingPriorDocumentNumber>31000000000001</fc2:EfilingPriorDocumentNumber>
           Scenario 2. The FinCEN CTR amends a prior report where the BSA ID is unknown:
           <fc2:EfilingPriorDocumentNumber>00000000000000</fc2:EfilingPriorDocumentNumber>
           Scenario 3. The FinCEN CTR is an initial report and therefore the BSA ID is not applicable:
           The element should NOT be recorded
           */
          EFilingPriorDocumentNumber: '00000000000000', //TODO provide option to set this in ui
          FilingDateText: dayjs().format('YYYYMMDD'), // TODO provide option to set in ui, wrong here
          ActivityAssociation: {
            // Correct/amend prior report (indicator). This element declares that the FinCEN CTR activity corrects or amends a previously-filed report.
            CorrectsAmendsPriorReportIndicator: '', // TODO provide option in ui, considering all report to be first
            // This element declares that FinCEN directed the financial institution to file the FinCEN CTR activity on a currency transaction or transactions not previously reported.
            FinCENDirectBackFileIndicator: '',
            // Initial report (indicator). This element declares that the FinCEN CTR activity is an initial report.
            InitialReportIndicator: 'Y',
          },
          Party: [
            transmitter,
            transmitterContact,
            reportingFinancialInstitution,
            assistanceContact,
            PersonConductingTransactionOnOwnBehalf,
            PersonConductingTransactionForAnother,
            PersonOnWhoseBehalfThisTransactionWasConducted,
            CommonCarrier,
            ...transactionLocations,
          ],
          CurrencyTransactionActivity,
        },
        FormTypeCode: 'CTRX',
      },
    }
  }

  public setTenantId(tenantId: string): void {
    this.tenantId = tenantId
  }
  // TODO
  async getPopulatedParameters(
    _c: Case,
    _transactions: InternalTransaction[],
    _reporter: Account
  ): Promise<ReportParameters> {
    const params: ReportParameters = {
      report: {},
      currencyTransaction: {},
    }
    return params
  }
  // TODO
  getUserPopulatedParameters(): Promise<ReportParameters> {
    throw new Error('Method getUserPopulatedParameters not implemented.')
  }

  getSchema(): ReportSchema {
    return {
      reportSchema: {
        type: 'object',
        properties: {
          transmitter: Transmitter,
          transmitterContact: TransmitterContact,
          filingInstitution: FilingInstitution,
          contactOffice: ContactOffice,
        },
        required: [
          'transmitter',
          'transmitterContact',
          'filingInstitution',
          'contactOffice',
        ],
        definitions: FincenJsonSchema.definitions,
      },
      currencyTransactionSchema: {
        type: 'object',
        properties: {
          transactionLocations: TransactionLocations,
          personsInvolvedInTransactions: PersonsInvolvedInTransactions,
          currencyTransactionActivity: CurrencyTransactionActivity,
        },
        required: [
          'transactionLocations',
          'currencyTransactionActivity',
          'personsInvolvedInTransactions',
        ],
        definitions: FincenJsonSchema.definitions,
      },
    }
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
    try {
      const builder = new XMLBuilder({
        attributeNamePrefix: '@',
        ignoreAttributes: false,
      })
      const xmlContent = builder.build(this.transform(cloneDeep(reportParams)))
      const outputFile = `${path.join('/tmp', 'input.xml')}`
      fs.writeFileSync(outputFile, xmlContent)
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
        value: finalFileContent,
      }
    } catch (e) {
      logger.error('Error generating CTR report:', e)
      throw e
    }
  }
  public async submit(report: Report) {
    if (isValidSARRequest(this.tenantId)) {
      const creds = await getSecretByName('fincenCreds')
      const sftp = await connectToSFTP()
      const remoteCwd = await sftp.cwd()
      const submissionsDir = remoteCwd + FincenSubmissionDirectory
      const remoteFilename = `CTRXST.${dayjs(report.createdAt).format(
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
      Sentry.captureMessage(`[${report.id}] New FinCEN CTR report submitted`)
    })
    return ''
  }
}
