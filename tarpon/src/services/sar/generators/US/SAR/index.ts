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
import { Case } from '@/@types/openapi-internal/Case'
import { Account } from '@/@types/openapi-internal/Account'
import { InternalTransaction } from '@/@types/openapi-internal/InternalTransaction'
import { ReportParameters } from '@/@types/openapi-internal/ReportParameters'
import { ReportSchema } from '@/@types/openapi-internal/ReportSchema'

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

  public getPopulatedSchema(
    _reportId: string,
    _c: Case,
    transactions: InternalTransaction[],
    _reporter: Account
  ): PopulatedSchema {
    const params = {
      report: {},
      transactions: transactions?.map((t) => {
        return { id: t.transactionId, transaction: {} }
      }),
      indicators: [],
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
