import { COUNTRY_CODES } from '@/@types/openapi-internal-custom/CountryCode'
import { CURRENCY_CODES } from '@/@types/openapi-internal-custom/CurrencyCode'

/**
 * The following JSON schema was derived from this document:
 * https://goaml.frc.go.ke/goAML_Prod/Images/customization/goAML_Schema%20v4.0.2%2001-03-2021.pdf
 *
 * This playground was used extensively test the behaviour:
 * https://rjsf-team.github.io/react-jsonschema-form/
 */
export const Schema = {
  type: 'object',
  required: [],
  properties: {
    reentity_id: {
      type: 'string',
    },
    reentity_branch: {
      type: 'string',
      nullable: true,
    },
    submission_code: {
      type: 'string',
      enum: ['E', 'M'],
    },
    report_code: {
      type: 'string',
    },
    entity_reference: {
      type: 'string',
      nullable: true,
    },
    fiu_ref_number: {
      type: 'string',
      nullable: true,
    },
    submission_date: {
      type: 'string',
    },
    currency_code_local: {
      $ref: '#/definitions/currency',
    },
    reporting_person: {
      type: 'array',
      items: {
        $ref: '#/definitions/t_person_registration_in_report',
      },
    },
    location: {
      type: 'array',
      items: {
        $ref: '#/definitions/t_address',
      },
    },
    reason: {
      type: 'string',
      nullable: true,
    },
    action: {
      type: 'string',
      nullable: true,
    },
    report_indicators: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          indicator: {
            type: 'string',
          },
        },
      },
      nullable: true,
    },
  },
  oneOf: [
    {
      properties: {
        transaction: {
          type: 'array',
          items: {
            $ref: '#/definitions/transaction',
          },
        },
      },
      required: ['transaction'],
    },
    {
      properties: {
        activity: {
          type: 'object',
          properties: {
            report_parties: {
              type: 'array',
              items: {
                $ref: '#/definitions/report_party_type',
              },
            },
          },
        },
      },
      required: ['activity'],
    },
  ],
  definitions: {
    t_address: {
      type: 'object',
      required: [],
      properties: {
        address_type: {
          type: 'string',
        },
        address: {
          type: 'string',
        },
        town: {
          type: 'string',
          nullable: true,
        },
        city: {
          type: 'string',
        },
        zip: {
          type: 'string',
          nullable: true,
        },
        state: {
          type: 'string',
          nullable: true,
        },
        comments: {
          type: 'string',
          nullable: true,
        },
      },
    },
    t_entity_my_client: {
      type: 'object',
      required: [],
      properties: {
        name: {
          type: 'string',
        },
        commercial_name: {
          type: 'string',
          nullable: true,
        },
        incorporation_legal_form: {
          type: 'string',
          nullable: true,
        },
        incorporation_number: {
          type: 'number',
          nullable: true,
        },
        business: {
          type: 'string',
          nullable: true,
        },
        phones: {
          type: 'array',
          items: {
            $ref: '#/definitions/t_phone',
          },
          nullable: true,
        },
        addresses: {
          type: 'array',
          items: {
            $ref: '#/definitions/t_address',
          },
          nullable: true,
        },
        email: {
          type: 'string',
        },
        url: {
          type: 'string',
        },
        incorporation_state: {
          type: 'string',
        },
        incorporation_count_code: {
          type: 'string',
        },
        director_id: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              role: {
                $ref: '#/definitions/entity_person_role_type',
              },
              person: {
                $ref: '#/definitions/t_person_my_client',
              },
            },
          },
        },
        incorporation_date: {
          type: 'string',
          nullable: true,
        },
        tax_number: {
          type: 'string',
          nullable: true,
        },
        tax_reg_number: {
          type: 'string',
          nullable: true,
        },
        comments: {
          type: 'string',
          nullable: true,
        },
        business_closed: {
          type: 'string',
        },
        date_business_closed: {
          type: 'string',
        },
      },
    },
    t_entity: {
      type: 'object',
      required: [],
      properties: {
        name: {
          type: 'string',
        },
        commercial_name: {
          type: 'string',
          nullable: true,
        },
        incorporation_legal_form: {
          type: 'string',
          nullable: true,
        },
        incorporation_number: {
          type: 'number',
          nullable: true,
        },
        business: {
          type: 'string',
          nullable: true,
        },
        phones: {
          type: 'array',
          items: {
            $ref: '#/definitions/t_phone',
          },
          nullable: true,
        },
        addresses: {
          type: 'array',
          items: {
            $ref: '#/definitions/t_address',
          },
          nullable: true,
        },
        email: {
          type: 'string',
        },
        url: {
          type: 'string',
        },
        incorporation_state: {
          type: 'string',
        },
        incorporation_count_code: {
          type: 'string',
        },
        director_id: {
          type: 'array',
          items: {
            type: {
              $ref: '#/definitions/t_person_my_client',
            },
          },
        },
        incorporation_date: {
          type: 'string',
          nullable: true,
        },
        tax_number: {
          type: 'string',
          nullable: true,
        },
        tax_reg_number: {
          type: 'string',
          nullable: true,
        },
        comments: {
          type: 'string',
          nullable: true,
        },
        business_closed: {
          type: 'string',
        },
        date_business_closed: {
          type: 'string',
        },
      },
    },
    report_party_type: {
      type: 'object',
      required: [],
      properties: {
        significance: {
          type: 'number',
        },
        reason: {
          type: 'string',
        },
        comments: {
          type: 'string',
        },
      },
      oneOf: [
        {
          properties: {
            person: {
              $ref: '#/definitions/t_person',
            },
          },
        },
        {
          properties: {
            person: {
              $ref: '#/definitions/t_account',
            },
          },
        },
        {
          properties: {
            person: {
              $ref: '#/definitions/t_entity',
            },
          },
        },
      ],
    },
    t_person_my_client: {
      type: 'object',
      required: [],
      properties: {
        gender: {
          type: 'string',
        },
        title: {
          type: 'string',
        },
        first_name: {
          type: 'string',
          nullable: true,
        },
        middle_name: {
          type: 'string',
          nullable: true,
        },
        prefix: {
          type: 'string',
          nullable: true,
        },
        last_name: {
          type: 'string',
        },
        birthdate: {
          type: 'string',
          nullable: true,
        },
        birth_place: {
          type: 'string',
          nullable: true,
        },
        mothers_name: {
          type: 'string',
          nullable: true,
        },
        alias: {
          type: 'string',
          nullable: true,
        },
        ssn: {
          type: 'string',
          nullable: true,
        },
        passport_number: {
          type: 'string',
          nullable: true,
        },
        passport_country: {
          $ref: '#/definitions/country_code',
          nullable: true,
        },
        id_number: {
          type: 'string',
          nullable: true,
        },
        nationality1: {
          type: 'string',
          nullable: true,
        },
        nationality2: {
          type: 'string',
          nullable: true,
        },
        nationality3: {
          type: 'string',
          nullable: true,
        },
        residence: {
          type: 'string',
          nullable: true,
        },
        phones: {
          type: 'array',
          items: {
            $ref: '#/definitions/t_phone',
          },
        },
        addresses: {
          type: 'array',
          items: {
            $ref: '#/definitions/t_address',
          },
        },
        email: {
          type: 'string',
        },
        occupation: {
          type: 'string',
        },
        employer_name: {
          type: 'string',
        },
        employer_address_id: {
          type: 'string',
        },
        employer_phone_id: {
          type: 'string',
        },
        identification: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        deceased: {
          type: 'boolean',
        },
        date_deceased: {
          type: 'string',
        },
        tax_number: {
          type: 'string',
          nullable: true,
        },
        tax_reg_number: {
          type: 'string',
          nullable: true,
        },
        source_of_wealth: {
          type: 'string',
          nullable: true,
        },
        comments: {
          type: 'string',
          nullable: true,
        },
      },
    },
    t_person: {
      type: 'object',
      required: [],
      properties: {
        gender: {
          type: 'string',
        },
        title: {
          type: 'string',
        },
        first_name: {
          type: 'string',
          nullable: true,
        },
        middle_name: {
          type: 'string',
          nullable: true,
        },
        prefix: {
          type: 'string',
          nullable: true,
        },
        last_name: {
          type: 'string',
        },
        birthdate: {
          type: 'string',
          nullable: true,
        },
        birth_place: {
          type: 'string',
          nullable: true,
        },
        mothers_name: {
          type: 'string',
          nullable: true,
        },
        alias: {
          type: 'string',
          nullable: true,
        },
        ssn: {
          type: 'string',
          nullable: true,
        },
        passport_number: {
          type: 'string',
          nullable: true,
        },
        passport_country: {
          $ref: '#/definitions/country_code',
          nullable: true,
        },
        id_number: {
          type: 'string',
          nullable: true,
        },
        nationality1: {
          type: 'string',
          nullable: true,
        },
        nationality2: {
          type: 'string',
          nullable: true,
        },
        nationality3: {
          type: 'string',
          nullable: true,
        },
        residence: {
          type: 'string',
          nullable: true,
        },
        phones: {
          type: 'array',
          items: {
            $ref: '#/definitions/t_phone',
          },
        },
        addresses: {
          type: 'array',
          items: {
            $ref: '#/definitions/t_address',
          },
        },
        email: {
          type: 'string',
        },
        occupation: {
          type: 'string',
        },
        employer_name: {
          type: 'string',
        },
        employer_address_id: {
          type: 'string',
        },
        employer_phone_id: {
          type: 'string',
        },
        identification: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        deceased: {
          type: 'boolean',
        },
        date_deceased: {
          type: 'string',
        },
        tax_number: {
          type: 'string',
          nullable: true,
        },
        tax_reg_number: {
          type: 'string',
          nullable: true,
        },
        source_of_wealth: {
          type: 'string',
          nullable: true,
        },
        comments: {
          type: 'string',
          nullable: true,
        },
      },
    },
    t_from: {
      type: 'object',
      required: [],
      properties: {
        from_funds_code: {
          $ref: '#/definitions/funds_code',
        },
        from_funds_comment: {
          type: 'string',
        },
        from_foreign_currency: {
          type: 'string',
        },
        t_conductor: {
          $ref: '#/definitions/t_conductor',
        },
        from_country: {
          $ref: '#/definitions/country_code',
        },
      },
    },
    account_status_code: {
      type: 'string',
      enum: ['A', 'B', 'C', 'FZ'],
    },
    identifier_type: {
      type: 'string',
      enum: ['ALIEN', 'BRTC', 'A', 'MLTC', 'B', 'D', 'C', 'URC'],
    },
    conduction_type: {
      type: 'string',
      enum: [
        'AD',
        'B',
        'ACD',
        'ACW',
        'CD001',
        'CP001',
        'D',
        'DTM',
        'DBCD',
        'EFT01',
        'FX001',
        'IMMT',
        'IMR',
        'IAT01',
        'LP001',
        'MM01',
        'MR01',
        'OMMT',
        'MR',
        'OCCD',
        'OCCW',
        'PL001',
        'RTGS',
        'SWIFT',
      ],
    },
    transaction_item_status: {
      type: 'string',
      enum: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
    },
    report_code: {
      type: 'string',
      enum: ['CTR', 'STR', 'SAR', 'MID', 'EFT', 'ORI', 'ORD', 'IRI', 'IRD'],
    },
    contact_type: {
      type: 'string',
      enum: ['B', 'P', 'O', 'R'],
    },
    communication_type: {
      type: 'string',
      enum: ['L', 'M', 'F', 'S', 'P'],
    },
    entity_legal_form_type: {
      type: 'string',
      enum: [
        'CO',
        'CBO',
        'CS',
        'FBO',
        'NGO',
        'PRSP',
        'A',
        'B',
        'PLC',
        'GOVT',
        'SPS',
        'TRST',
      ],
    },
    transaction_item_type: {
      type: 'string',
      enum: ['E', 'F', '1', 'J', 'P', 'V', 'W'],
    },
    currency: {
      type: 'string',
      enum: CURRENCY_CODES,
    },
    country_code: {
      type: 'string',
      enum: COUNTRY_CODES,
    },
    account_person_role_type: {
      type: 'string',
      enum: ['AAGNT', 'GD', 'NM', 'PA', 'A', 'SSRL', 'TRST'],
    },
    entity_person_role_type: {
      type: 'string',
      enum: [
        'ADM',
        'AGNT1',
        'BNF',
        'CMN',
        'DCMN',
        'A',
        'MMR',
        'NMN',
        'SEC',
        'STL',
        'SHLD',
        'TRSR',
        'TRST',
      ],
    },
    funds_code: {
      type: 'string',
      enum: [
        'AAT',
        'E',
        'BC01',
        'BST',
        'CD1',
        'CDFC',
        'CTBB',
        'CWFC',
        'CDOB',
        'COB',
        'C',
        'INTC',
        'H',
        'LP',
        'MR',
        'OESP',
        'OCCD',
        'CW1',
        'INT',
        'PCC',
        'STO',
        'TFA',
        'TFDB',
        'TTA',
        'TTDB',
      ],
    },
    account_type: {
      type: 'string',
      enum: ['KeB', 'keFD', 'KeG', 'KeL', 'KeM', 'KeP', 'AGNT', 'CDS', 'ESC'],
    },
    t_account_my_client: {
      type: 'object',
      required: [],
      properties: {
        institution_name: {
          type: 'string',
          nullable: true,
        },
        non_bank_institution: {
          type: 'string',
          nullable: true,
        },
        branch: {
          type: 'string',
          nullable: true,
        },
        account: {
          type: 'string',
        },
        currency_code: {
          type: 'string',
          nullable: true,
        },
        account_name: {
          type: 'string',
          nullable: true,
        },
        iban: {
          type: 'string',
          nullable: true,
        },
        client_number: {
          type: 'string',
          nullable: true,
        },
        personal_account_type: {
          $ref: '#/definitions/account_type',
          nullable: true,
        },
        t_entity: {
          type: 'array',
          items: {
            $ref: '#/definitions/t_entity',
          },
          nullable: true,
        },
        signatory: {
          type: 'array',
          items: {
            $ref: '#/definitions/t_person',
          },
          nullable: true,
        },
        opened: {
          type: 'string',
        },
        closed: {
          type: 'string',
          nullable: true,
        },
        balance: {
          type: 'number',
        },
        date_balance: {
          type: 'string',
        },
        status_code: {
          $ref: '#/definitions/account_status_code',
        },
        beneficiary: {
          type: 'string',
          nullable: true,
        },
        beneficiary_comment: {
          type: 'string',
          nullable: true,
        },
        comments: {
          type: 'string',
          nullable: true,
        },
      },
      anyOf: [
        {
          properties: {
            institution_code: {
              type: 'string',
            },
          },
        },
        {
          properties: {
            swift: {
              type: 'string',
            },
          },
        },
      ],
    },
    t_from_my_client: {
      type: 'object',
      required: [],
      oneOf: [
        {
          properties: {
            from_account: {
              type: 'array',
              items: {
                $ref: '#/definitions/t_account_my_client',
              },
            },
            from_person: {
              type: 'array',
              items: {
                $ref: '#/definitions/t_person_my_client',
              },
            },
            from_entity: {
              type: 'array',
              items: {
                $ref: '#/definitions/t_entity_my_client',
              },
            },
          },
        },
      ],
      properties: {
        from_funds_code: {
          $ref: '#/definitions/funds_code',
        },
        from_funds_code_comment: {
          type: 'string',
          nullable: true,
        },
        from_funds_currency: {
          type: 'array',
          nullable: true,
          items: {
            $ref: '#/definitions/t_foreign_currency',
          },
        },
        from_country: {
          $ref: '#/definitions/country_code',
        },
        t_conductor: {
          $ref: '#/definitions/t_conductor',
        },
      },
    },
    t_conductor: {
      type: 'array',
      items: {
        $ref: '#/definitions/t_person_my_client',
      },
    },
    t_to: {
      type: 'object',
      required: [],
      properties: {
        to_funds_code: {
          $ref: '#/definitions/funds_code',
        },
        to_funds_comment: {
          type: 'string',
        },
        to_foreign_currency: {
          type: 'string',
        },
        to_country: {
          $ref: '#/definitions/country_code',
        },
      },
      anyOf: [
        {
          properties: {
            to_account: {
              $ref: '#/definitions/t_account',
            },
          },
        },
        {
          properties: {
            to_person: {
              $ref: '#/definitions/t_person',
            },
          },
        },
        {
          properties: {
            to_entity: {
              $ref: '#/definitions/t_entity',
            },
          },
        },
      ],
    },
    t_to_my_client: {
      type: 'object',
      required: [],
      properties: {
        to_funds_codes: {
          $ref: '#/definitions/funds_code',
        },
        to_funds_comment: {
          type: 'string',
        },
        to_funds_currency: {
          type: 'string',
        },
        to_country: {
          $ref: '#/definitions/country_code',
        },
      },
      oneOf: [
        {
          properties: {
            to_account: {
              $ref: '#/definitions/t_account',
            },
          },
          required: ['to_account'],
        },
        {
          properties: {
            to_person: {
              type: {
                $ref: '#/definitions/t_person',
              },
            },
          },
          required: ['to_person'],
        },
        {
          properties: {
            to_entity: {
              type: {
                $ref: '#/definitions/t_entity',
              },
            },
          },
          required: ['to_entity'],
        },
      ],
    },
    t_party: {
      type: 'object',
      required: [],
      properties: {
        role: {
          $ref: '#/definitions/account_person_role_type',
        },
        funds_code: {
          $ref: '#/definitions/funds_code',
          nullable: true,
        },
        funds_comment: {
          type: 'string',
          nullable: true,
        },
        foreign_currency: {
          type: 'array',
          items: {
            type: 'string',
          },
          nullable: true,
        },
        country: {
          $ref: '#/definitions/country_code',
        },
        significance: {
          type: 'string',
          nullable: true,
        },
        comments: {
          type: 'string',
          nullable: true,
        },
      },
      oneOf: [
        {
          $ref: '#/definitions/t_person',
        },
        {
          $ref: '#/definitions/t_account',
        },
        {
          $ref: '#/definitions/t_account_my_client',
        },
        {
          $ref: '#/definitions/t_entity',
        },
        {
          $ref: '#/definitions/t_entity_my_client',
        },
      ],
    },
    t_account: {
      type: 'object',
      required: [],
      properties: {
        institution_name: {
          type: 'string',
          nullable: true,
        },
        non_bank_institution: {
          type: 'string',
          nullable: true,
        },
        branch: {
          type: 'string',
          nullable: true,
        },
        account: {
          type: 'string',
        },
        currency_code: {
          $ref: '#/definitions/currency',
          nullable: true,
        },
        account_name: {
          type: 'string',
          nullable: true,
        },
        iban: {
          type: 'string',
          nullable: true,
        },
        client_number: {
          type: 'string',
          nullable: true,
        },
        personal_account_type: {
          $ref: '#/definitions/account_type',
          nullable: true,
        },
        t_entity: {
          type: 'array',
          items: {
            $ref: '#/definitions/t_entity',
          },
          nullable: true,
        },
        signatory: {
          type: 'array',
          items: {
            $ref: '#/definitions/t_person',
          },
          nullable: true,
        },
        opened: {
          type: 'string',
          nullable: true,
        },
        closed: {
          type: 'string',
          nullable: true,
        },
        balance: {
          type: 'number',
          nullable: true,
        },
        date_balance: {
          type: 'string',
          nullable: true,
        },
        status_code: {
          $ref: '#/definitions/account_status_code',
          nullable: true,
        },
        beneficiary: {
          type: 'string',
          nullable: true,
        },
        beneficiary_comment: {
          type: 'string',
          nullable: true,
        },
        comments: {
          type: 'string',
          nullable: true,
        },
      },
      anyOf: [
        {
          properties: {
            institution_code: {
              type: 'string',
            },
          },
        },
        {
          properties: {
            swift: {
              type: 'string',
            },
          },
        },
      ],
    },
    t_phone: {
      type: 'object',
      required: [],
      properties: {
        tph_contact_type: {
          type: 'string',
        },
        tph_communication_type: {
          type: 'string',
        },
        tph_country_prefix: {
          type: 'string',
          nullable: true,
        },
        tph_number: {
          type: 'string',
        },
        tph_extension: {
          type: 'string',
          nullable: true,
        },
        comments: {
          type: 'string',
          nullable: true,
        },
      },
    },
    t_foreign_currency: {
      type: 'object',
      required: [],
      properties: {
        foreign_currency_code: {
          $ref: '#/definitions/currency',
        },
        foreign_amount: {
          type: 'number',
        },
        foreign_exchange_range: {
          type: 'number',
        },
      },
    },
    t_person_identification: {
      type: 'object',
      required: [],
      properties: {
        type: {
          $ref: '#/definitions/identifier_type',
        },
        number: {
          type: 'string',
        },
        issue_date: {
          type: 'string',
          nullable: true,
        },
        expiry_date: {
          type: 'string',
          nullable: true,
        },
        issued_by: {
          type: 'string',
          nullable: true,
        },
        issued_country: {
          $ref: '#/definitions/country_code',
        },
        comments: {
          type: 'string',
        },
      },
    },
    t_person_registration_in_report: {
      type: 'object',
      required: [],
      properties: {
        gender: {
          type: 'string',
        },
        title: {
          type: 'string',
        },
        first_name: {
          type: 'string',
          nullable: true,
        },
        middle_name: {
          type: 'string',
          nullable: true,
        },
        prefix: {
          type: 'string',
          nullable: true,
        },
        last_name: {
          type: 'string',
        },
        birthdate: {
          type: 'string',
          nullable: true,
        },
        birth_place: {
          type: 'string',
          nullable: true,
        },
        mothers_name: {
          type: 'string',
          nullable: true,
        },
        alias: {
          type: 'string',
          nullable: true,
        },
        ssn: {
          type: 'string',
          nullable: true,
        },
        passport_number: {
          type: 'string',
          nullable: true,
        },
        passport_country: {
          $ref: '#/definitions/country_code',
          nullable: true,
        },
        id_number: {
          type: 'string',
          nullable: true,
        },
        nationality1: {
          type: 'string',
          nullable: true,
        },
        nationality2: {
          type: 'string',
          nullable: true,
        },
        nationality3: {
          type: 'string',
          nullable: true,
        },
        residence: {
          type: 'string',
          nullable: true,
        },
        phones: {
          type: 'array',
          items: {
            $ref: '#/definitions/t_phone',
          },
        },
        addresses: {
          type: 'array',
          items: {
            $ref: '#/definitions/t_address',
          },
        },
        email: {
          type: 'string',
        },
        occupation: {
          type: 'string',
        },
        employer_name: {
          type: 'string',
        },
        employer_address_id: {
          type: 'string',
        },
        employer_phone_id: {
          type: 'string',
        },
        identification: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        deceased: {
          type: 'boolean',
        },
        date_deceased: {
          type: 'string',
        },
        tax_number: {
          type: 'string',
          nullable: true,
        },
        tax_reg_number: {
          type: 'string',
          nullable: true,
        },
        source_of_wealth: {
          type: 'string',
          nullable: true,
        },
        comments: {
          type: 'string',
          nullable: true,
        },
      },
    },
    t_trans_item: {
      type: 'object',
      required: [],
      properties: {
        item_type: {
          type: 'string',
        },
        item_make: {
          type: 'string',
        },
        description: {
          type: 'string',
        },
        previously_registered_to: {
          type: 'string',
        },
        presently_registered_to: {
          type: 'string',
        },
        estimated_value: {
          type: 'number',
        },
        status_code: {
          $ref: '#/definitions/account_status_code',
        },
        status_comments: {
          type: 'string',
        },
        disposed_value: {
          type: 'number',
        },
        currency_code: {
          $ref: '#/definitions/currency',
        },
        size: {
          type: 'number',
        },
        size_uom: {
          type: 'string',
        },
        registration_date: {
          type: 'string',
        },
        registration_number: {
          type: 'string',
        },
        identification_number: {
          type: 'string',
        },
        comments: {
          type: 'string',
        },
        address: {
          $ref: '#/definitions/t_address',
        },
      },
    },
    transaction: {
      type: 'object',
      required: [],
      properties: {
        transaction_number: {
          type: 'string',
        },
        internal_ref_number: {
          type: 'string',
          nullable: true,
        },
        transaction_location: {
          type: 'string',
          nullable: true,
        },
        transaction_description: {
          type: 'string',
        },
        date_transaction: {
          type: 'string',
        },
        teller: {
          type: 'string',
          nullable: true,
        },
        authorized: {
          type: 'string',
          nullable: true,
        },
        late_deposit: {
          type: 'boolean',
          nullable: true,
        },
        date_posting: {
          type: 'string',
          nullable: true,
        },
        value_date: {
          type: 'string',
          nullable: true,
        },
        transmode_code: {
          $ref: '#/definitions/conduction_type',
        },
        transmode_comment: {
          type: 'string',
          nullable: true,
        },
        amount_local: {
          type: 'number',
        },
        goods_services: {
          type: 'array',
          items: {
            $ref: '#/definitions/t_trans_item',
          },
        },
        comments: {
          type: 'string',
        },
      },
      oneOf: [
        {
          properties: {
            involved_parties: {
              $ref: '#/definitions/t_party',
            },
          },
          required: ['involved_parties'],
        },
        {
          properties: {
            t_from_my_client: {
              $ref: '#/definitions/t_from_my_client',
            },
            t_to_my_client: {
              $ref: '#/definitions/t_to_my_client',
            },
          },
          required: ['t_from_my_client', 't_to_my_client'],
        },
      ],
    },
  },
}
