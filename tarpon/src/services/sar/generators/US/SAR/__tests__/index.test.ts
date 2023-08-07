import path from 'path'
import * as fs from 'fs'
import { UsSarReportGenerator } from '..'

const testInputParams = {
  report: {
    generalInfo: {
      FilingDateText: '20230807',
      ActivityAssociation: {
        InitialReportIndicator: 'Y',
        JointReportIndicator: '',
      },
      ActivityNarrativeInformation: [
        {
          ActivityNarrativeSequenceNumber: '1',
          ActivityNarrativeText: 'Test narrative',
        },
      ],
      ActivitySupportDocument: {
        OriginalAttachmentFileName: 'test-attachment.pdf',
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
      FlagrightPartyIdentificationTcc: {
        PartyIdentificationNumberText: '111111111111',
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
        ActivityPartyTypeCode: '33',
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
        ActivityPartyTypeCode: '33',
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
        ActivityPartyTypeCode: '34',
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
}

// TODO: Unskip this in https://www.notion.so/flagright/FinCEN-Remove-hardcoded-demo-data-666c253f2fbf42c8abeadcc2371721f6?pvs=4
describe.skip('FinCEN SAR Generation', () => {
  test('Should generate valid XML file', async () => {
    const generator = new UsSarReportGenerator()
    const xml = generator.generate(testInputParams)
    const expectedOutput = fs.readFileSync(
      path.join(__dirname, 'expected-test-output.xml'),
      'utf8'
    )
    expect(xml).toEqual(expectedOutput)
  })
})
