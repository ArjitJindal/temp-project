import path from 'path'
import * as fs from 'fs'
import { UsSarReportGenerator } from '..'
import { Report } from '@/@types/openapi-internal/Report'

const report: Report = {
  parameters: {
    report: {
      generalInfo: {
        FilingDateText: '20230807',
        EFilingPriorDocumentNumber: '00000000000001',
        ActivityAssociation: {
          CorrectsAmendsPriorReportIndicator: 'Y',
          JointReportIndicator: '',
        },
        ActivityNarrativeInformation: {
          ActivityNarrativeText: 'Test narrative',
        },
      },
      transmitter: {
        PartyName: {
          RawPartyFullName: 'Test Transmitter Name',
        },
        Address: {
          RawCityText: 'Berlin',
          RawCountryCodeText: 'DE',
          RawStateCodeText: 'US',
          RawStreetAddress1Text: 'Schlüterstraße 18',
          RawZIPCode: '10625',
        },
        PhoneNumber: {
          PhoneNumberText: '0123456789',
        },
        FlagrightPartyIdentificationTin: {
          PartyIdentificationNumberText: '111111111111',
        },
      },
      transmitterContact: {
        PartyName: {
          RawPartyFullName: 'Test Transmitter Contact Name',
        },
      },
      filingInstitution: {
        PrimaryRegulatorTypeCode: '99',
        OrganizationClassificationTypeSubtype: [
          {
            OrganizationTypeID: '999',
          },
        ],
        PartyName: {
          RawPartyFullName: 'Test Filing Institution Name',
        },
        Address: {
          RawCityText: 'Berlin',
          RawCountryCodeText: 'DE',
          RawStateCodeText: 'US',
          RawStreetAddress1Text: 'Schlüterstraße 18',
          RawZIPCode: '10625',
        },
        FlagrightPartyIdentificationTin: {
          PartyIdentificationNumberText: '111111111111',
          PartyIdentificationTypeCode: '2',
        },
      },
      contactOffice: {
        PartyName: {
          RawPartyFullName: 'Test Designated Contact Office Name',
        },
        PhoneNumber: {
          PhoneNumberText: '9876543210',
        },
      },
    },
    transactionMetadata: {
      subjects: [
        {
          PhoneNumber: [],
          ElectronicAddress: [
            {
              ElectronicAddressText: 'info@innotech.com',
              ElectronicAddressTypeCode: 'E',
            },
            {
              ElectronicAddressText: 'support@innotech.com',
              ElectronicAddressTypeCode: 'E',
            },
          ],
          PartyName: {
            '0': {
              PartyNameTypeCode: 'L',
              RawPartyFullName: 'InnoTech',
            },
            RawIndividualFirstName: 'Subject 1 First Name',
            RawEntityIndividualLastName: 'Subject 1 Last Name',
          },
          PartyAccountAssociation: {
            PartyAccountAssociationTypeCode: '7',
          },
          Address: [
            {
              CityUnknownIndicator: 'Y',
            },
          ],
          FlagrightPartyIdentificationTin: {
            PartyIdentificationNumberText: '547898569',
            PartyIdentificationTypeCode: '2',
          },
          PartyIdentification: [
            {
              PartyIdentificationTypeCode: '6',
              PartyIdentificationNumberText: '310309329',
            },
          ],
        },
        {
          PhoneNumber: [],
          ElectronicAddress: [
            {
              ElectronicAddressText: 'info@datatech.com',
              ElectronicAddressTypeCode: 'E',
            },
            {
              ElectronicAddressText: 'support@datatech.com',
              ElectronicAddressTypeCode: 'E',
            },
          ],
          PartyName: [
            {
              PartyNameTypeCode: 'L',
              RawPartyFullName: 'DataTech',
            },
          ],
          Address: [
            {
              CityUnknownIndicator: 'Y',
            },
          ],
          FlagrightPartyIdentificationTin: {
            PartyIdentificationNumberText: '547898560',
            PartyIdentificationTypeCode: '2',
          },
          PartyIdentification: [
            {
              PartyIdentificationTypeCode: '999',
              TINUnknownIndicator: 'Y',
            },
          ],
        },
      ],
      suspiciousActivity: {
        TotalSuspiciousAmountText: '5052',
        NoAmountInvolvedIndicator: '',
        SuspiciousActivityFromDateText: '20220808',
        SuspiciousActivityToDateText: '20230329',
        SuspiciousActivityClassification: [
          {
            SuspiciousActivitySubtypeID: '1005',
            SuspiciousActivityTypeID: '11',
          },
        ],
      },
      financialInstitutions: [
        {
          PartyName: {
            PartyNameTypeCode: 'L',
            EntityLastNameUnknownIndicator: 'Y',
          },
          PayLocationIndicator: 'Y',
          SellingLocationIndicator: '',
          OrganizationClassificationTypeSubtype: [
            {
              OrganizationTypeID: '2',
            },
          ],
          PrimaryRegulatorTypeCode: '6',
          Address: [
            {
              CountryCodeUnknownIndicator: 'Y',
            },
          ],
          FlagrightPartyIdentificationTin: {
            PartyIdentificationTypeCode: '2',
            PartyIdentificationNumberText: '111111111111',
          },
        },
      ],
      otherInfo: {
        ActivityIPAddress: [
          {
            IPAddressText: '166.43.48.198',
          },
          {
            IPAddressText: '102.154.239.59',
          },
        ],
      },
    },
    indicators: [],
    transactions: [
      {
        id: 'T-750',
        transaction: {},
      },
      {
        id: 'T-702',
        transaction: {},
      },
      {
        id: 'T-628',
        transaction: {},
      },
    ],
  },
  name: 'RP-1',
  description: 'Test report for tests',
  status: 'COMPLETE',
  caseId: 'C-1',
  reportTypeId: 'US-SAR',
  caseUserId: 'test-user-id',
  createdById: 'test-user',
  createdAt: 1694726448,
  updatedAt: 1694726448,
  comments: [],
  revisions: [],
  attachments: [
    {
      s3Key: 'test-s3-key',
      filename: 'test-attachment.pdf',
      size: 1024,
    },
  ],
}

describe('FinCEN SAR Generation', () => {
  test('Should generate valid XML file', async () => {
    const generator = new UsSarReportGenerator()
    const testInputParams = generator.getAugmentedReportParams(report)
    const xml = await generator.generate(testInputParams)
    const expectedOutput = fs.readFileSync(
      path.join(__dirname, 'expected-test-output.xml'),
      'utf8'
    )
    expect(xml).toEqual({ type: 'STRING', value: expectedOutput })
  })
})
