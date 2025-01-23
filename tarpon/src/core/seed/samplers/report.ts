import { isNil, omitBy } from 'lodash'
import { BaseSampler } from './base'
import { Report } from '@/@types/openapi-internal/Report'
import { UsSarReportGenerator } from '@/services/sar/generators/US/SAR'
import { KenyaSARReportGenerator } from '@/services/sar/generators/KE/SAR'
import { getAccounts } from '@/core/seed/samplers/accounts'
import { FINCEN_REPORT_VALID_STATUSS } from '@/@types/openapi-internal-custom/FincenReportValidStatus'
import { NON_FINCEN_REPORT_VALID_STATUSS } from '@/@types/openapi-internal-custom/NonFincenReportValidStatus'

export class ReportSampler extends BaseSampler<Report> {
  protected generateSample(
    reportId: string,
    caseId: string,
    caseUserId: string,
    parentReportId?: string,
    childIds?: string[]
  ): Report {
    const randomNumber = this.rng.randomInt(Number.MAX_SAFE_INTEGER)
    if (randomNumber % 2 == 0) {
      return this.sampleKenyaReport(reportId, caseId, caseUserId)
    }
    return this.sampleFincenReport(
      reportId,
      caseId,
      caseUserId,
      parentReportId,
      childIds
    )
  }
  private sampleKenyaReport(
    reportId: string,
    caseId: string,
    caseUserId: string
  ): Report & { _id: string } {
    const accounts = getAccounts()
    const creationTimestamp = this.generateRandomTimestamp(1)
    const updationTimestamp = this.generateRandomTimestamp(
      1,
      new Date(creationTimestamp).toISOString()
    )
    return {
      _id: reportId,
      id: reportId,
      name: caseId,
      description: `SAR report for ${caseId}`,
      status: this.rng.pickRandom(NON_FINCEN_REPORT_VALID_STATUSS),
      caseId,
      reportTypeId: 'KE-SAR',
      createdById: this.rng.pickRandom(accounts).id,
      createdAt: creationTimestamp,
      updatedAt: updationTimestamp,
      parameters: {
        report: {
          submission_code: 'E',
          report_code: 'SAR',
          entity_reference: 'RP-6',
          submission_date: '2023-07-26T06:47:20.584Z',
          currency_code_local: 'USD',
          reporting_person: {
            email: 'jayant@flagright.com',
            gender: 'M',
            first_name: 'FIRST',
            last_name: 'LAST',
            employer_address_id: {
              address_type: 'B',
              address: 'ADDRESS',
              city: 'CITY',
              zip: '',
              country_code: 'AF',
            },
            employer_phone_id: {
              tph_contact_type: 'B',
              tph_communication_type: 'L',
              tph_number: '8888999944',
            },
          },
          reentity_id: 'ID_333333',
          location: {
            address_type: 'B',
            address: 'Address',
            city: 'City',
            country_code: 'AF',
          },
        },
        indicators: ['AIF', 'CCH'],
        transactions: [
          {
            id: '93cb5835-fb0a-4292-a31f-e7b72d8d7336',
            transaction: {
              transaction_number: '93cb5835-fb0a-4292-a31f-e7b72d8d7336',
              internal_ref_number: '93cb5835-fb0a-4292-a31f-e7b72d8d7336',
              date_transaction: '2023-04-18T11:57:54.228Z',
              transmode_comment: 'CARD to WALLET',
              amount_local: 133,
              t_from_my_client: {
                from_account: {
                  t_entity: {
                    phones: [],
                    addresses: [
                      {
                        address_type: 'B',
                        address: 'Klara-Franke Str 20',
                        zip: '10557',
                        country_code: 'Germany',
                        state: 'Berlin',
                      },
                    ],
                    director_id: [
                      {
                        first_name: 'Baran',
                        last_name: 'Ozkan',
                        nationality1: 'DE',
                        residence: 'US',
                        birthdate: '1991-01-01',
                        passport_number: 'Z9431P',
                        passport_country: 'DE',
                        email: [],
                        addresses: [
                          {
                            address_type: 'B',
                            address: 'Klara-Franke Str 20',
                            zip: '10557',
                            country_code: 'Germany',
                            state: 'Berlin',
                          },
                        ],
                      },
                    ],
                    name: 'Evergreen Capital Partners, LLP',
                    commercial_name: 'Evergreen Capital Partners, LLP',
                    incorporation_legal_form: 'Evergreen Capital Partners, LLP',
                    incorporation_number: 'DEK8976K',
                    business: [],
                    tax_registration_number: 'DEK8976K',
                  },
                  personal_account_type: 'KeB',
                  opened: '2023-04-18T06:36:51.895Z',
                  status_code: 'A',
                  comments: '',
                  currency_code: 'USD',
                },
                from_funds_code: 'E',
                from_country: 'US',
              },
              t_to_my_client: {
                to_account: {
                  t_entity: {
                    phones: [],
                    addresses: [
                      {
                        address_type: 'B',
                        address: 'Klara-Franke Str 20',
                        zip: '10557',
                        country_code: 'Germany',
                        state: 'Berlin',
                      },
                    ],
                    director_id: [
                      {
                        first_name: 'Baran',
                        last_name: 'Ozkan',
                        nationality1: 'DE',
                        residence: 'US',
                        birthdate: '1991-01-01',
                        passport_number: 'Z9431P',
                        passport_country: 'DE',
                        email: [],
                        addresses: [
                          {
                            address_type: 'B',
                            address: 'Klara-Franke Str 20',
                            zip: '10557',
                            country_code: 'Germany',
                            state: 'Berlin',
                          },
                        ],
                      },
                    ],
                    name: 'Pinnacle Ventures, LP',
                    commercial_name: 'Pinnacle Ventures, LP',
                    incorporation_legal_form: 'Pinnacle Ventures, LP',
                    incorporation_number: '47537EF5',
                    business: [],
                    tax_registration_number: '47537EF5',
                  },
                  personal_account_type: 'KeB',
                  opened: '2023-04-18T07:24:39.127Z',
                  status_code: 'A',
                  comments: '',
                  currency_code: 'USD',
                },
                to_funds_code: 'E',
                to_country: 'GB',
              },
            },
          },
        ],
      },
      comments: [],
      revisions: [
        {
          output:
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><report><reentity_id>ID_333333</reentity_id><submission_code>E</submission_code><report_code>SAR</report_code><entity_reference>RP-6</entity_reference><submission_date>2023-07-26T06:47:20.584Z</submission_date><currency_code_local>USD</currency_code_local><reporting_person><email>jayant@flagright.com</email><gender>M</gender><first_name>FIRST</first_name><last_name>LAST</last_name><employer_address_id><address_type>B</address_type><address>ADDRESS</address><city>CITY</city><zip></zip><country_code>AF</country_code></employer_address_id><employer_phone_id><tph_contact_type>B</tph_contact_type><tph_communication_type>L</tph_communication_type><tph_number>8888999944</tph_number></employer_phone_id></reporting_person><location><address_type>B</address_type><address>Address</address><city>City</city><country_code>AF</country_code></location><transaction><transaction_number>93cb5835-fb0a-4292-a31f-e7b72d8d7336</transaction_number><internal_ref_number>93cb5835-fb0a-4292-a31f-e7b72d8d7336</internal_ref_number><date_transaction>2023-04-18T11:57:54.228Z</date_transaction><transmode_comment>CARD to WALLET</transmode_comment><amount_local>133</amount_local><t_from_my_client><from_account><t_entity><addresses><address_type>B</address_type><address>Klara-Franke Str 20</address><zip>10557</zip><country_code>Germany</country_code><state>Berlin</state></addresses><director_id><first_name>Baran</first_name><last_name>Ozkan</last_name><nationality1>DE</nationality1><residence>US</residence><birthdate>1991-01-01</birthdate><passport_number>Z9431P</passport_number><passport_country>DE</passport_country><addresses><address_type>B</address_type><address>Klara-Franke Str 20</address><zip>10557</zip><country_code>Germany</country_code><state>Berlin</state></addresses></director_id><name>Evergreen Capital Partners, LLP</name><commercial_name>Evergreen Capital Partners, LLP</commercial_name><incorporation_legal_form>Evergreen Capital Partners, LLP</incorporation_legal_form><incorporation_number>DEK8976K</incorporation_number><tax_registration_number>DEK8976K</tax_registration_number></t_entity><personal_account_type>KeB</personal_account_type><opened>2023-04-18T06:36:51.895Z</opened><status_code>A</status_code><comments></comments><currency_code>USD</currency_code></from_account><from_funds_code>E</from_funds_code><from_country>US</from_country></t_from_my_client><t_to_my_client><to_account><t_entity><addresses><address_type>B</address_type><address>Klara-Franke Str 20</address><zip>10557</zip><country_code>Germany</country_code><state>Berlin</state></addresses><director_id><first_name>Baran</first_name><last_name>Ozkan</last_name><nationality1>DE</nationality1><residence>US</residence><birthdate>1991-01-01</birthdate><passport_number>Z9431P</passport_number><passport_country>DE</passport_country><addresses><address_type>B</address_type><address>Klara-Franke Str 20</address><zip>10557</zip><country_code>Germany</country_code><state>Berlin</state></addresses></director_id><name>Pinnacle Ventures, LP</name><commercial_name>Pinnacle Ventures, LP</commercial_name><incorporation_legal_form>Pinnacle Ventures, LP</incorporation_legal_form><incorporation_number>47537EF5</incorporation_number><tax_registration_number>47537EF5</tax_registration_number></t_entity><personal_account_type>KeB</personal_account_type><opened>2023-04-18T07:24:39.127Z</opened><status_code>A</status_code><comments></comments><currency_code>USD</currency_code></to_account><to_funds_code>E</to_funds_code><to_country>GB</to_country></t_to_my_client></transaction><report_indicators><indicator>AIF</indicator></report_indicators><report_indicators><indicator>CCH</indicator></report_indicators></report>',
          createdAt: 1690354718320,
        },
      ],
      schema: new KenyaSARReportGenerator().getSchema(),
      caseUserId,
    }
  }

  private sampleFincenReport(
    reportId: string,
    caseId: string,
    caseUserId: string,
    parentReportId?: string,
    childIds?: string[]
  ): Report & { _id: string } {
    const accounts = getAccounts()

    const creationTimestamp = this.generateRandomTimestamp(1)
    const updationTimestamp = this.generateRandomTimestamp(
      1,
      new Date(creationTimestamp).toISOString()
    )
    return {
      _id: reportId,
      id: reportId,
      name: caseId,
      description: `SAR report for ${caseId}`,
      caseId: caseId,
      caseUserId: caseUserId,
      schema: new UsSarReportGenerator().getSchema(),
      reportTypeId: 'US-SAR',
      createdAt: creationTimestamp,
      updatedAt: updationTimestamp,
      createdById: this.rng.pickRandom(accounts).id,
      status: this.rng.pickRandom(FINCEN_REPORT_VALID_STATUSS),
      parameters: {
        report: {
          generalInfo: {
            ActivityAssociation: {
              ContinuingActivityReportIndicator: 'Y',
            },
            FilingDateText: '20230807',
            ActivityNarrativeInformation: [
              {
                ActivityNarrativeSequenceNumber: '1',
                ActivityNarrativeText: '',
              },
            ],
          },
          transmitter: {
            PartyName: {
              PartyNameTypeCode: 'L',
              RawPartyFullName: 'Baran Ozkan',
            },
            Address: [
              {
                CityUnknownIndicator: 'Y',
                CountryCodeUnknownIndicator: 'Y',
                StateCodeUnknownIndicator: 'Y',
                StreetAddressUnknownIndicator: 'Y',
                ZIPCodeUnknownIndicator: 'Y',
                RawCityText: '1209 Orange Street',
                RawCountryCodeText: 'US',
                RawStateCodeText: 'DE',
                RawStreetAddress1Text: 'Schlüterstr. 18',
                RawZIPCode: '1213',
              },
            ],
            PhoneNumber: [
              {
                PhoneNumberExtensionText: '5584',
                PhoneNumberText: '6194760276',
                PhoneNumberTypeCode: 'R',
              },
            ],
            PartyIdentification: [
              {
                PartyIdentificationNumberText: '458985215',
                PartyIdentificationTypeCode: '4',
              },
              {
                PartyIdentificationNumberText: '458985215',
                PartyIdentificationTypeCode: '28',
              },
            ],
            FlagrightPartyIdentificationTin: {
              PartyIdentificationNumberText: '123123',
            },
          },
          transmitterContact: {
            PartyName: {
              PartyNameTypeCode: 'L',
              RawPartyFullName: 'N/A',
            },
          },
          filingInstitution: {
            PrimaryRegulatorTypeCode: '1',
            PartyName: {
              PartyNameTypeCode: 'L',
              RawPartyFullName: 'Baran Ozkan',
            },
            Address: [
              {
                CityUnknownIndicator: 'Y',
                CountryCodeUnknownIndicator: 'Y',
                StateCodeUnknownIndicator: 'Y',
                StreetAddressUnknownIndicator: 'Y',
                ZIPCodeUnknownIndicator: 'Y',
                RawCityText: '1209 Orange Street',
                RawCountryCodeText: 'US',
                RawStateCodeText: 'DE',
                RawStreetAddress1Text: 'q',
                RawZIPCode: '1221',
              },
            ],
            PartyIdentification: [
              {
                PartyIdentificationTypeCode: '2',
              },
            ],
            OrganizationClassificationTypeSubtype: [
              {
                OrganizationTypeID: '5',
              },
            ],
            AlternateName: {
              RawPartyFullName: 'Baran Ozkan',
            },
            FlagrightPartyIdentificationTin: {
              PartyIdentificationNumberText: '121',
              PartyIdentificationTypeCode: '2',
            },
            FlagrightPartyIdentificationFilingInstitutionIdentification: {
              PartyIdentificationNumberText: '12312',
              PartyIdentificationTypeCode: '10',
            },
            FlagrightPartyIdentificationInternalControl: {
              PartyIdentificationNumberText: '1231231',
            },
          },
          contactOffice: {
            PartyName: {
              PartyNameTypeCode: 'L',
              RawPartyFullName: 'N/A',
            },
            PhoneNumber: [
              {
                PhoneNumberExtensionText: '5584',
                PhoneNumberText: '6194760276',
                PhoneNumberTypeCode: 'R',
              },
            ],
          },
        },
        transactionMetadata: {
          subjects: [
            {
              Address: [
                {
                  CityUnknownIndicator: 'Y',
                  CountryCodeUnknownIndicator: 'Y',
                  StateCodeUnknownIndicator: 'Y',
                  StreetAddressUnknownIndicator: 'Y',
                  ZIPCodeUnknownIndicator: 'Y',
                },
              ],
              PhoneNumber: [],
              ElectronicAddress: [
                {
                  ElectronicAddressText: 'info@fitzone.com',
                  ElectronicAddressTypeCode: 'E',
                },
                {
                  ElectronicAddressText: 'support@fitzone.com',
                  ElectronicAddressTypeCode: 'E',
                },
                {
                  ElectronicAddressText: 'www.fitzone.com',
                  ElectronicAddressTypeCode: 'U',
                },
              ],
              PartyIdentification: [
                {
                  OtherIssuerCountryText: 'US',
                  OtherIssuerStateText: 'CA',
                  OtherPartyIdentificationTypeText: 'Student ID',
                  PartyIdentificationNumberText: '660623559',
                  PartyIdentificationTypeCode: '999',
                },
              ],
              ActivityPartyTypeCode: '33',
              PartyName: [
                {
                  PartyNameTypeCode: 'L',
                  RawPartyFullName: 'FitZone',
                },
              ],
            },
          ],
          suspiciousActivity: {
            TotalSuspiciousAmountText: '4366',
            SuspiciousActivityFromDateText: '20220816',
            SuspiciousActivityToDateText: '20230305',
            SuspiciousActivityClassification: [
              {
                SuspiciousActivitySubtypeID: 9999,
                SuspiciousActivityTypeID: 9,
              },
            ],
            AmountUnknownIndicator: 'Y',
            NoAmountInvolvedIndicator: 'Y',
          },
          financialInstitutions: [
            {
              ActivityPartyTypeCode: '34',
              PartyName: {
                PartyNameTypeCode: 'L',
                RawPartyFullName: 'Citigroup',
              },
              PayLocationIndicator: 'Y',
              OrganizationClassificationTypeSubtype: [
                {
                  OrganizationTypeID: '5',
                },
              ],
              Address: [
                {
                  CityUnknownIndicator: 'Y',
                  CountryCodeUnknownIndicator: 'Y',
                  StateCodeUnknownIndicator: 'Y',
                  StreetAddressUnknownIndicator: 'Y',
                  ZIPCodeUnknownIndicator: 'Y',
                },
              ],
              PrimaryRegulatorTypeCode: '1',
              PartyIdentification: [
                {
                  PartyIdentificationTypeCode: '2',
                },
              ],
              FlagrightPartyIdentificationTin: {
                PartyIdentificationTypeCode: '2',
              },
              FlagrightPartyIdentificationFinancialInstitutionIdentification: {
                PartyIdentificationNumberText: '1231',
                PartyIdentificationTypeCode: '10',
              },
              FlagrightPartyIdentificationInternalControl: {
                PartyIdentificationNumberText: '1213',
              },
            },
          ],
          otherInfo: {
            ActivityIPAddress: [],
          },
        },
        indicators: [],
        transactions: [
          {
            id: 'T-771',
            transaction: {},
          },
          {
            id: 'T-606',
            transaction: {},
          },
        ],
      },
      comments: [],
      revisions: [
        {
          output:
            '<fc2:EFilingBatchXML TotalAmount="4366" PartyCount="1" ActivityCount="1" xsi:schemaLocation="www.fincen.gov/base https://www.fincen.gov/base/EFL_FinCENSARXBatchSchema.xsd" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:fc2="www.fincen.gov/base">\n  <fc2:FormTypeCode>SARX</fc2:FormTypeCode>\n  <fc2:Activity SeqNum="1">\n    <fc2:EFilingPriorDocumentNumber>00000000000000</fc2:EFilingPriorDocumentNumber>\n    <fc2:FilingDateText>20230807</fc2:FilingDateText>\n    <fc2:ActivityAssociation SeqNum="2">\n      <fc2:ContinuingActivityReportIndicator>Y</fc2:ContinuingActivityReportIndicator>\n    </fc2:ActivityAssociation>\n    <fc2:Party SeqNum="3">\n      <fc2:ActivityPartyTypeCode>35</fc2:ActivityPartyTypeCode>\n      <fc2:PartyName SeqNum="4">\n        <fc2:PartyNameTypeCode>L</fc2:PartyNameTypeCode>\n        <fc2:RawPartyFullName>Baran Ozkan</fc2:RawPartyFullName>\n      </fc2:PartyName>\n      <fc2:Address SeqNum="5">\n        <fc2:CityUnknownIndicator>Y</fc2:CityUnknownIndicator>\n        <fc2:CountryCodeUnknownIndicator>Y</fc2:CountryCodeUnknownIndicator>\n        <fc2:RawCityText>1209 Orange Street</fc2:RawCityText>\n        <fc2:RawCountryCodeText>US</fc2:RawCountryCodeText>\n        <fc2:RawStateCodeText>DE</fc2:RawStateCodeText>\n        <fc2:RawStreetAddress1Text>Schlüterstr. 18</fc2:RawStreetAddress1Text>\n        <fc2:RawZIPCode>1213</fc2:RawZIPCode>\n        <fc2:StateCodeUnknownIndicator>Y</fc2:StateCodeUnknownIndicator>\n        <fc2:StreetAddressUnknownIndicator>Y</fc2:StreetAddressUnknownIndicator>\n        <fc2:ZIPCodeUnknownIndicator>Y</fc2:ZIPCodeUnknownIndicator>\n      </fc2:Address>\n      <fc2:PhoneNumber SeqNum="6">\n        <fc2:PhoneNumberExtensionText>5584</fc2:PhoneNumberExtensionText>\n        <fc2:PhoneNumberText>6194760276</fc2:PhoneNumberText>\n        <fc2:PhoneNumberTypeCode>R</fc2:PhoneNumberTypeCode>\n      </fc2:PhoneNumber>\n      <fc2:PartyIdentification SeqNum="7">\n        <fc2:PartyIdentificationNumberText>2131</fc2:PartyIdentificationNumberText>\n        <fc2:PartyIdentificationTypeCode>28</fc2:PartyIdentificationTypeCode>\n      </fc2:PartyIdentification>\n      <fc2:PartyIdentification SeqNum="8">\n        <fc2:PartyIdentificationNumberText>123123</fc2:PartyIdentificationNumberText>\n        <fc2:PartyIdentificationTypeCode>4</fc2:PartyIdentificationTypeCode>\n      </fc2:PartyIdentification>\n    </fc2:Party>\n    <fc2:Party SeqNum="9">\n      <fc2:ActivityPartyTypeCode>37</fc2:ActivityPartyTypeCode>\n      <fc2:PartyName SeqNum="10">\n        <fc2:PartyNameTypeCode>L</fc2:PartyNameTypeCode>\n        <fc2:RawPartyFullName>N/A</fc2:RawPartyFullName>\n      </fc2:PartyName>\n    </fc2:Party>\n    <fc2:Party SeqNum="11">\n      <fc2:ActivityPartyTypeCode>30</fc2:ActivityPartyTypeCode>\n      <fc2:PrimaryRegulatorTypeCode>1</fc2:PrimaryRegulatorTypeCode>\n      <fc2:PartyName SeqNum="12">\n        <fc2:PartyNameTypeCode>L</fc2:PartyNameTypeCode>\n        <fc2:RawPartyFullName>Baran Ozkan</fc2:RawPartyFullName>\n      </fc2:PartyName>\n      <fc2:PartyName SeqNum="13">\n        <fc2:RawPartyFullName>Baran Ozkan</fc2:RawPartyFullName>\n      </fc2:PartyName>\n      <fc2:Address SeqNum="14">\n        <fc2:CityUnknownIndicator>Y</fc2:CityUnknownIndicator>\n        <fc2:CountryCodeUnknownIndicator>Y</fc2:CountryCodeUnknownIndicator>\n        <fc2:RawCityText>1209 Orange Street</fc2:RawCityText>\n        <fc2:RawCountryCodeText>US</fc2:RawCountryCodeText>\n        <fc2:RawStateCodeText>DE</fc2:RawStateCodeText>\n        <fc2:RawStreetAddress1Text>q</fc2:RawStreetAddress1Text>\n        <fc2:RawZIPCode>1221</fc2:RawZIPCode>\n        <fc2:StateCodeUnknownIndicator>Y</fc2:StateCodeUnknownIndicator>\n        <fc2:StreetAddressUnknownIndicator>Y</fc2:StreetAddressUnknownIndicator>\n        <fc2:ZIPCodeUnknownIndicator>Y</fc2:ZIPCodeUnknownIndicator>\n      </fc2:Address>\n      <fc2:PartyIdentification SeqNum="15">\n        <fc2:PartyIdentificationNumberText>121</fc2:PartyIdentificationNumberText>\n        <fc2:PartyIdentificationTypeCode>2</fc2:PartyIdentificationTypeCode>\n      </fc2:PartyIdentification>\n      <fc2:PartyIdentification SeqNum="16">\n        <fc2:PartyIdentificationNumberText>12312</fc2:PartyIdentificationNumberText>\n        <fc2:PartyIdentificationTypeCode>10</fc2:PartyIdentificationTypeCode>\n      </fc2:PartyIdentification>\n      <fc2:PartyIdentification SeqNum="17">\n        <fc2:PartyIdentificationNumberText>1231231</fc2:PartyIdentificationNumberText>\n        <fc2:PartyIdentificationTypeCode>29</fc2:PartyIdentificationTypeCode>\n      </fc2:PartyIdentification>\n      <fc2:OrganizationClassificationTypeSubtype SeqNum="18">\n        <fc2:OrganizationTypeID>5</fc2:OrganizationTypeID>\n      </fc2:OrganizationClassificationTypeSubtype>\n    </fc2:Party>\n    <fc2:Party SeqNum="19">\n      <fc2:ActivityPartyTypeCode>8</fc2:ActivityPartyTypeCode>\n      <fc2:PartyName SeqNum="20">\n        <fc2:PartyNameTypeCode>L</fc2:PartyNameTypeCode>\n        <fc2:RawPartyFullName>N/A</fc2:RawPartyFullName>\n      </fc2:PartyName>\n      <fc2:PhoneNumber SeqNum="21">\n        <fc2:PhoneNumberExtensionText>5584</fc2:PhoneNumberExtensionText>\n        <fc2:PhoneNumberText>6194760276</fc2:PhoneNumberText>\n        <fc2:PhoneNumberTypeCode>R</fc2:PhoneNumberTypeCode>\n      </fc2:PhoneNumber>\n    </fc2:Party>\n    <fc2:Party SeqNum="22">\n      <fc2:ActivityPartyTypeCode>33</fc2:ActivityPartyTypeCode>\n      <fc2:PartyName SeqNum="23">\n        <fc2:PartyNameTypeCode>L</fc2:PartyNameTypeCode>\n        <fc2:RawPartyFullName>FitZone</fc2:RawPartyFullName>\n      </fc2:PartyName>\n      <fc2:Address SeqNum="24">\n        <fc2:CityUnknownIndicator>Y</fc2:CityUnknownIndicator>\n        <fc2:CountryCodeUnknownIndicator>Y</fc2:CountryCodeUnknownIndicator>\n        <fc2:StateCodeUnknownIndicator>Y</fc2:StateCodeUnknownIndicator>\n        <fc2:StreetAddressUnknownIndicator>Y</fc2:StreetAddressUnknownIndicator>\n        <fc2:ZIPCodeUnknownIndicator>Y</fc2:ZIPCodeUnknownIndicator>\n      </fc2:Address>\n      <fc2:PartyIdentification SeqNum="25">\n        <fc2:OtherIssuerCountryText>US</fc2:OtherIssuerCountryText>\n        <fc2:OtherIssuerStateText>CA</fc2:OtherIssuerStateText>\n        <fc2:OtherPartyIdentificationTypeText>Student ID</fc2:OtherPartyIdentificationTypeText>\n        <fc2:PartyIdentificationNumberText>660623559</fc2:PartyIdentificationNumberText>\n        <fc2:PartyIdentificationTypeCode>999</fc2:PartyIdentificationTypeCode>\n      </fc2:PartyIdentification>\n      <fc2:ElectronicAddress SeqNum="26">\n        <fc2:ElectronicAddressText>info@fitzone.com</fc2:ElectronicAddressText>\n        <fc2:ElectronicAddressTypeCode>E</fc2:ElectronicAddressTypeCode>\n      </fc2:ElectronicAddress>\n      <fc2:ElectronicAddress SeqNum="27">\n        <fc2:ElectronicAddressText>support@fitzone.com</fc2:ElectronicAddressText>\n        <fc2:ElectronicAddressTypeCode>E</fc2:ElectronicAddressTypeCode>\n      </fc2:ElectronicAddress>\n      <fc2:ElectronicAddress SeqNum="28">\n        <fc2:ElectronicAddressText>www.fitzone.com</fc2:ElectronicAddressText>\n        <fc2:ElectronicAddressTypeCode>U</fc2:ElectronicAddressTypeCode>\n      </fc2:ElectronicAddress>\n    </fc2:Party>\n    <fc2:Party SeqNum="29">\n      <fc2:ActivityPartyTypeCode>34</fc2:ActivityPartyTypeCode>\n      <fc2:PayLocationIndicator>Y</fc2:PayLocationIndicator>\n      <fc2:PrimaryRegulatorTypeCode>1</fc2:PrimaryRegulatorTypeCode>\n      <fc2:PartyName SeqNum="30">\n        <fc2:PartyNameTypeCode>L</fc2:PartyNameTypeCode>\n        <fc2:RawPartyFullName>Citigroup</fc2:RawPartyFullName>\n      </fc2:PartyName>\n      <fc2:Address SeqNum="31">\n        <fc2:CityUnknownIndicator>Y</fc2:CityUnknownIndicator>\n        <fc2:CountryCodeUnknownIndicator>Y</fc2:CountryCodeUnknownIndicator>\n        <fc2:StateCodeUnknownIndicator>Y</fc2:StateCodeUnknownIndicator>\n        <fc2:StreetAddressUnknownIndicator>Y</fc2:StreetAddressUnknownIndicator>\n        <fc2:ZIPCodeUnknownIndicator>Y</fc2:ZIPCodeUnknownIndicator>\n      </fc2:Address>\n      <fc2:PartyIdentification SeqNum="32">\n        <fc2:PartyIdentificationTypeCode>2</fc2:PartyIdentificationTypeCode>\n      </fc2:PartyIdentification>\n      <fc2:PartyIdentification SeqNum="33">\n        <fc2:PartyIdentificationNumberText>1231</fc2:PartyIdentificationNumberText>\n        <fc2:PartyIdentificationTypeCode>10</fc2:PartyIdentificationTypeCode>\n      </fc2:PartyIdentification>\n      <fc2:PartyIdentification SeqNum="34">\n        <fc2:PartyIdentificationNumberText>1213</fc2:PartyIdentificationNumberText>\n        <fc2:PartyIdentificationTypeCode>29</fc2:PartyIdentificationTypeCode>\n      </fc2:PartyIdentification>\n      <fc2:OrganizationClassificationTypeSubtype SeqNum="35">\n        <fc2:OrganizationTypeID>5</fc2:OrganizationTypeID>\n      </fc2:OrganizationClassificationTypeSubtype>\n    </fc2:Party>\n    <fc2:SuspiciousActivity SeqNum="36">\n      <fc2:AmountUnknownIndicator>Y</fc2:AmountUnknownIndicator>\n      <fc2:NoAmountInvolvedIndicator>Y</fc2:NoAmountInvolvedIndicator>\n      <fc2:SuspiciousActivityFromDateText>20220816</fc2:SuspiciousActivityFromDateText>\n      <fc2:SuspiciousActivityToDateText>20230305</fc2:SuspiciousActivityToDateText>\n      <fc2:TotalSuspiciousAmountText>4366</fc2:TotalSuspiciousAmountText>\n      <fc2:SuspiciousActivityClassification SeqNum="37">\n        <fc2:SuspiciousActivitySubtypeID>9999</fc2:SuspiciousActivitySubtypeID>\n        <fc2:SuspiciousActivityTypeID>9</fc2:SuspiciousActivityTypeID>\n      </fc2:SuspiciousActivityClassification>\n    </fc2:SuspiciousActivity>\n    <fc2:ActivityNarrativeInformation SeqNum="38">\n      <fc2:ActivityNarrativeSequenceNumber>1</fc2:ActivityNarrativeSequenceNumber>\n      <fc2:ActivityNarrativeText></fc2:ActivityNarrativeText>\n    </fc2:ActivityNarrativeInformation>\n  </fc2:Activity>\n</fc2:EFilingBatchXML>\n',
          createdAt: 1691431951412,
        },
        {
          output:
            '<fc2:EFilingBatchXML TotalAmount="4366" PartyCount="1" ActivityCount="1" xsi:schemaLocation="www.fincen.gov/base https://www.fincen.gov/base/EFL_FinCENSARXBatchSchema.xsd" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:fc2="www.fincen.gov/base">\n  <fc2:FormTypeCode>SARX</fc2:FormTypeCode>\n  <fc2:Activity SeqNum="1">\n    <fc2:EFilingPriorDocumentNumber>00000000000000</fc2:EFilingPriorDocumentNumber>\n    <fc2:FilingDateText>20230807</fc2:FilingDateText>\n    <fc2:ActivityAssociation SeqNum="2">\n      <fc2:ContinuingActivityReportIndicator>Y</fc2:ContinuingActivityReportIndicator>\n    </fc2:ActivityAssociation>\n    <fc2:Party SeqNum="3">\n      <fc2:ActivityPartyTypeCode>35</fc2:ActivityPartyTypeCode>\n      <fc2:PartyName SeqNum="4">\n        <fc2:PartyNameTypeCode>L</fc2:PartyNameTypeCode>\n        <fc2:RawPartyFullName>Baran Ozkan</fc2:RawPartyFullName>\n      </fc2:PartyName>\n      <fc2:Address SeqNum="5">\n        <fc2:CityUnknownIndicator>Y</fc2:CityUnknownIndicator>\n        <fc2:CountryCodeUnknownIndicator>Y</fc2:CountryCodeUnknownIndicator>\n        <fc2:RawCityText>1209 Orange Street</fc2:RawCityText>\n        <fc2:RawCountryCodeText>US</fc2:RawCountryCodeText>\n        <fc2:RawStateCodeText>DE</fc2:RawStateCodeText>\n        <fc2:RawStreetAddress1Text>Schlüterstr. 18</fc2:RawStreetAddress1Text>\n        <fc2:RawZIPCode>1213</fc2:RawZIPCode>\n        <fc2:StateCodeUnknownIndicator>Y</fc2:StateCodeUnknownIndicator>\n        <fc2:StreetAddressUnknownIndicator>Y</fc2:StreetAddressUnknownIndicator>\n        <fc2:ZIPCodeUnknownIndicator>Y</fc2:ZIPCodeUnknownIndicator>\n      </fc2:Address>\n      <fc2:PhoneNumber SeqNum="6">\n        <fc2:PhoneNumberExtensionText>5584</fc2:PhoneNumberExtensionText>\n        <fc2:PhoneNumberText>6194760276</fc2:PhoneNumberText>\n        <fc2:PhoneNumberTypeCode>R</fc2:PhoneNumberTypeCode>\n      </fc2:PhoneNumber>\n      <fc2:PartyIdentification SeqNum="7">\n        <fc2:PartyIdentificationNumberText>2131</fc2:PartyIdentificationNumberText>\n        <fc2:PartyIdentificationTypeCode>28</fc2:PartyIdentificationTypeCode>\n      </fc2:PartyIdentification>\n      <fc2:PartyIdentification SeqNum="8">\n        <fc2:PartyIdentificationNumberText>123123</fc2:PartyIdentificationNumberText>\n        <fc2:PartyIdentificationTypeCode>4</fc2:PartyIdentificationTypeCode>\n      </fc2:PartyIdentification>\n    </fc2:Party>\n    <fc2:Party SeqNum="9">\n      <fc2:ActivityPartyTypeCode>37</fc2:ActivityPartyTypeCode>\n      <fc2:PartyName SeqNum="10">\n        <fc2:PartyNameTypeCode>L</fc2:PartyNameTypeCode>\n        <fc2:RawPartyFullName>N/A</fc2:RawPartyFullName>\n      </fc2:PartyName>\n    </fc2:Party>\n    <fc2:Party SeqNum="11">\n      <fc2:ActivityPartyTypeCode>30</fc2:ActivityPartyTypeCode>\n      <fc2:PrimaryRegulatorTypeCode>1</fc2:PrimaryRegulatorTypeCode>\n      <fc2:PartyName SeqNum="12">\n        <fc2:PartyNameTypeCode>L</fc2:PartyNameTypeCode>\n        <fc2:RawPartyFullName>Baran Ozkan</fc2:RawPartyFullName>\n      </fc2:PartyName>\n      <fc2:PartyName SeqNum="13">\n        <fc2:RawPartyFullName>Baran Ozkan</fc2:RawPartyFullName>\n      </fc2:PartyName>\n      <fc2:Address SeqNum="14">\n        <fc2:CityUnknownIndicator>Y</fc2:CityUnknownIndicator>\n        <fc2:CountryCodeUnknownIndicator>Y</fc2:CountryCodeUnknownIndicator>\n        <fc2:RawCityText>1209 Orange Street</fc2:RawCityText>\n        <fc2:RawCountryCodeText>US</fc2:RawCountryCodeText>\n        <fc2:RawStateCodeText>DE</fc2:RawStateCodeText>\n        <fc2:RawStreetAddress1Text>q</fc2:RawStreetAddress1Text>\n        <fc2:RawZIPCode>1221</fc2:RawZIPCode>\n        <fc2:StateCodeUnknownIndicator>Y</fc2:StateCodeUnknownIndicator>\n        <fc2:StreetAddressUnknownIndicator>Y</fc2:StreetAddressUnknownIndicator>\n        <fc2:ZIPCodeUnknownIndicator>Y</fc2:ZIPCodeUnknownIndicator>\n      </fc2:Address>\n      <fc2:PartyIdentification SeqNum="15">\n        <fc2:PartyIdentificationNumberText>121</fc2:PartyIdentificationNumberText>\n        <fc2:PartyIdentificationTypeCode>2</fc2:PartyIdentificationTypeCode>\n      </fc2:PartyIdentification>\n      <fc2:PartyIdentification SeqNum="16">\n        <fc2:PartyIdentificationNumberText>12312</fc2:PartyIdentificationNumberText>\n        <fc2:PartyIdentificationTypeCode>10</fc2:PartyIdentificationTypeCode>\n      </fc2:PartyIdentification>\n      <fc2:PartyIdentification SeqNum="17">\n        <fc2:PartyIdentificationNumberText>1231231</fc2:PartyIdentificationNumberText>\n        <fc2:PartyIdentificationTypeCode>29</fc2:PartyIdentificationTypeCode>\n      </fc2:PartyIdentification>\n      <fc2:OrganizationClassificationTypeSubtype SeqNum="18">\n        <fc2:OrganizationTypeID>5</fc2:OrganizationTypeID>\n      </fc2:OrganizationClassificationTypeSubtype>\n    </fc2:Party>\n    <fc2:Party SeqNum="19">\n      <fc2:ActivityPartyTypeCode>8</fc2:ActivityPartyTypeCode>\n      <fc2:PartyName SeqNum="20">\n        <fc2:PartyNameTypeCode>L</fc2:PartyNameTypeCode>\n        <fc2:RawPartyFullName>N/A</fc2:RawPartyFullName>\n      </fc2:PartyName>\n      <fc2:PhoneNumber SeqNum="21">\n        <fc2:PhoneNumberExtensionText>5584</fc2:PhoneNumberExtensionText>\n        <fc2:PhoneNumberText>6194760276</fc2:PhoneNumberText>\n        <fc2:PhoneNumberTypeCode>R</fc2:PhoneNumberTypeCode>\n      </fc2:PhoneNumber>\n    </fc2:Party>\n    <fc2:Party SeqNum="22">\n      <fc2:ActivityPartyTypeCode>33</fc2:ActivityPartyTypeCode>\n      <fc2:PartyName SeqNum="23">\n        <fc2:PartyNameTypeCode>L</fc2:PartyNameTypeCode>\n        <fc2:RawPartyFullName>FitZone</fc2:RawPartyFullName>\n      </fc2:PartyName>\n      <fc2:Address SeqNum="24">\n        <fc2:CityUnknownIndicator>Y</fc2:CityUnknownIndicator>\n        <fc2:CountryCodeUnknownIndicator>Y</fc2:CountryCodeUnknownIndicator>\n        <fc2:StateCodeUnknownIndicator>Y</fc2:StateCodeUnknownIndicator>\n        <fc2:StreetAddressUnknownIndicator>Y</fc2:StreetAddressUnknownIndicator>\n        <fc2:ZIPCodeUnknownIndicator>Y</fc2:ZIPCodeUnknownIndicator>\n      </fc2:Address>\n      <fc2:PartyIdentification SeqNum="25">\n        <fc2:OtherIssuerCountryText>US</fc2:OtherIssuerCountryText>\n        <fc2:OtherIssuerStateText>CA</fc2:OtherIssuerStateText>\n        <fc2:OtherPartyIdentificationTypeText>Student ID</fc2:OtherPartyIdentificationTypeText>\n        <fc2:PartyIdentificationNumberText>660623559</fc2:PartyIdentificationNumberText>\n        <fc2:PartyIdentificationTypeCode>999</fc2:PartyIdentificationTypeCode>\n      </fc2:PartyIdentification>\n      <fc2:ElectronicAddress SeqNum="26">\n        <fc2:ElectronicAddressText>info@fitzone.com</fc2:ElectronicAddressText>\n        <fc2:ElectronicAddressTypeCode>E</fc2:ElectronicAddressTypeCode>\n      </fc2:ElectronicAddress>\n      <fc2:ElectronicAddress SeqNum="27">\n        <fc2:ElectronicAddressText>support@fitzone.com</fc2:ElectronicAddressText>\n        <fc2:ElectronicAddressTypeCode>E</fc2:ElectronicAddressTypeCode>\n      </fc2:ElectronicAddress>\n      <fc2:ElectronicAddress SeqNum="28">\n        <fc2:ElectronicAddressText>www.fitzone.com</fc2:ElectronicAddressText>\n        <fc2:ElectronicAddressTypeCode>U</fc2:ElectronicAddressTypeCode>\n      </fc2:ElectronicAddress>\n    </fc2:Party>\n    <fc2:Party SeqNum="29">\n      <fc2:ActivityPartyTypeCode>34</fc2:ActivityPartyTypeCode>\n      <fc2:PayLocationIndicator>Y</fc2:PayLocationIndicator>\n      <fc2:PrimaryRegulatorTypeCode>1</fc2:PrimaryRegulatorTypeCode>\n      <fc2:PartyName SeqNum="30">\n        <fc2:PartyNameTypeCode>L</fc2:PartyNameTypeCode>\n        <fc2:RawPartyFullName>Citigroup</fc2:RawPartyFullName>\n      </fc2:PartyName>\n      <fc2:Address SeqNum="31">\n        <fc2:CityUnknownIndicator>Y</fc2:CityUnknownIndicator>\n        <fc2:CountryCodeUnknownIndicator>Y</fc2:CountryCodeUnknownIndicator>\n        <fc2:StateCodeUnknownIndicator>Y</fc2:StateCodeUnknownIndicator>\n        <fc2:StreetAddressUnknownIndicator>Y</fc2:StreetAddressUnknownIndicator>\n        <fc2:ZIPCodeUnknownIndicator>Y</fc2:ZIPCodeUnknownIndicator>\n      </fc2:Address>\n      <fc2:PartyIdentification SeqNum="32">\n        <fc2:PartyIdentificationTypeCode>2</fc2:PartyIdentificationTypeCode>\n      </fc2:PartyIdentification>\n      <fc2:PartyIdentification SeqNum="33">\n        <fc2:PartyIdentificationNumberText>1231</fc2:PartyIdentificationNumberText>\n        <fc2:PartyIdentificationTypeCode>10</fc2:PartyIdentificationTypeCode>\n      </fc2:PartyIdentification>\n      <fc2:PartyIdentification SeqNum="34">\n        <fc2:PartyIdentificationNumberText>1213</fc2:PartyIdentificationNumberText>\n        <fc2:PartyIdentificationTypeCode>29</fc2:PartyIdentificationTypeCode>\n      </fc2:PartyIdentification>\n      <fc2:OrganizationClassificationTypeSubtype SeqNum="35">\n        <fc2:OrganizationTypeID>5</fc2:OrganizationTypeID>\n      </fc2:OrganizationClassificationTypeSubtype>\n    </fc2:Party>\n    <fc2:SuspiciousActivity SeqNum="36">\n      <fc2:AmountUnknownIndicator>Y</fc2:AmountUnknownIndicator>\n      <fc2:NoAmountInvolvedIndicator>Y</fc2:NoAmountInvolvedIndicator>\n      <fc2:SuspiciousActivityFromDateText>20220816</fc2:SuspiciousActivityFromDateText>\n      <fc2:SuspiciousActivityToDateText>20230305</fc2:SuspiciousActivityToDateText>\n      <fc2:TotalSuspiciousAmountText>4366</fc2:TotalSuspiciousAmountText>\n      <fc2:SuspiciousActivityClassification SeqNum="37">\n        <fc2:SuspiciousActivitySubtypeID>9999</fc2:SuspiciousActivitySubtypeID>\n        <fc2:SuspiciousActivityTypeID>9</fc2:SuspiciousActivityTypeID>\n      </fc2:SuspiciousActivityClassification>\n    </fc2:SuspiciousActivity>\n    <fc2:ActivityNarrativeInformation SeqNum="38">\n      <fc2:ActivityNarrativeSequenceNumber>1</fc2:ActivityNarrativeSequenceNumber>\n      <fc2:ActivityNarrativeText>/fc2:ActivityNarrativeText>\n    </fc2:ActivityNarrativeInformation>\n  </fc2:Activity>\n</fc2:EFilingBatchXML>\n',
          createdAt: 1691431998435,
        },
      ],
      hierarchy: omitBy(
        {
          parentId: parentReportId,
          childIds: childIds,
        },
        isNil
      ),
    }
  }
}
