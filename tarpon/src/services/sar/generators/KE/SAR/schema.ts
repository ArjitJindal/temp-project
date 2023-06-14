import { COUNTRY_CODES } from '@/@types/openapi-internal-custom/CountryCode'
import { CURRENCY_CODES } from '@/@types/openapi-internal-custom/CurrencyCode'

/**
 * The following JSON schema was derived from this document:
 * https://goaml.frc.go.ke/goAML_Prod/Images/customization/goAML_Schema%20v4.0.2%2001-03-2021.pdf
 *
 * This playground was used extensively test the behaviour:
 * https://rjsf-team.github.io/react-jsonschema-form/
 */
const Definitions = {
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
}

export const KenyaTransactionSchema = {
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
  definitions: Definitions,
}

export const KenyaReportSchema = {
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
  definitions: Definitions,
}

export const indicators = [
  { key: 'AIF', description: 'AIF/Non-suspicious Transactions' },
  { key: 'CCH', description: 'CC/High' },
  { key: 'CCL', description: 'CC/Low' },
  { key: 'CCM', description: 'CC/Medium' },
  { key: 'CCN', description: 'CC/Not Classified Yet' },
  {
    key: 'CIUS',
    description: 'CIU/Never Updated (Relationship has not started yet)',
  },
  {
    key: 'CIUN',
    description:
      'CIU/Never updated during the last 5 years (Relationship started before a five years period)',
  },
  {
    key: 'CIUR',
    description:
      'CIU/Never updated during the last 5 years (Relationship started within a five years period)',
  },
  { key: 'CIUM', description: 'CIU/Updated during the last 12 months' },
  { key: 'CIUT', description: 'CIU/Updated during the last 3 years' },
  { key: 'CIUF', description: 'CIU/Updated during the last 5 years' },
  { key: 'CTC', description: 'CT/Company' },
  { key: 'CTE', description: 'CT/Employee' },
  { key: 'CTFI', description: 'CT/Financial Institution' },
  { key: 'CTGO', description: 'CT/Government Entity' },
  { key: 'CTIP', description: 'CT/International PEP' },
  { key: 'CTHC', description: 'CT/Is connected to a high risk country' },
  { key: 'CTHLA', description: 'CT/Is connected to a high-risk local area' },
  { key: 'CTLP', description: 'CT/Local PEP' },
  { key: 'CTM', description: 'CT/Minor' },
  { key: 'CTNR', description: 'CT/Nonresident' },
  { key: 'CTNE', description: 'CT/Not Employed' },
  { key: 'CTNP', description: 'CT/NPO' },
  { key: 'CTSE', description: 'CT/Self Employed' },
  { key: 'CTST', description: 'CT/Student' },
  { key: 'CTTL', description: 'CT/Trust or Other Form of Legal Arrangements' },
  { key: 'DMAR', description: 'DM/Automated reports' },
  {
    key: 'DMLA',
    description: 'DM/Legal Action Initiated in relation to suspect',
  },
  { key: 'DMCM', description: 'DM/Manual monitoring via compliance officer' },
  { key: 'DMER', description: 'DM/Manual reporting via other employee' },
  { key: 'DMNM', description: 'DM/News on media' },
  { key: 'PCC', description: 'PC/Counterfeiting and piracy of products' },
  { key: 'PCAN', description: 'PC/Crimes committed against antiquities.' },
  { key: 'PCBR', description: 'PC/Crimes of bribery' },
  { key: 'PCP', description: 'PC/Crimes of debauchery and prostitution.' },
  { key: 'PCD', description: 'PC/Crimes of deception and breach of faith' },
  { key: 'PCF', description: 'PC/Crimes of falsification' },
  { key: 'PCFR', description: 'PC/Crimes of forgery of banknotes and coins' },
  { key: 'PCFD', description: 'PC/Crimes of fraud and deceit.' },
  { key: 'PCFT', description: 'PC/Crimes of Funds theft and usurpation' },
  {
    key: 'PCHI',
    description:
      'PC/Crimes of hijacking means of transport and detaining individuals.',
  },
  {
    key: 'PCNS',
    description:
      'PC/Crimes of narcotics and psychotropic substances (planting, manufacturing, smuggling, exporting and trafficking)',
  },
  {
    key: 'PCE',
    description:
      'PC/Crimes of public Funds embezzlement, transgression and peculation',
  },
  { key: 'PCT', description: 'PC/Crimes of terrorism' },
  { key: 'PCTF', description: 'PC/Crimes of terrorism financing.' },
  {
    key: 'PCW',
    description:
      'PC/Crimes of weaponry, ammunition and explosives (unlicensed importation, trading and manufacturing)',
  },
  { key: 'PCRC', description: 'PC/Customs related crimes' },
  { key: 'PCCC', description: 'PC/Cyber Crimes' },
  {
    key: 'PCEN',
    description:
      'PC/Environmental crimes related to dangerous wastes and materials.',
  },
  { key: 'PCIG', description: 'PC/Illicit gains' },
  { key: 'PCIN', description: 'PC/Insider trading' },
  { key: 'PCMM', description: 'PC/Market Manipulation' },
  {
    key: 'PCDC',
    description:
      'PC/Not declaring or False declaration of Funds and bearer assets',
  },
  {
    key: 'PCSA',
    description:
      'PC/Offences & misdemeanors to the security of the government (abroad)',
  },
  {
    key: 'PCSD',
    description:
      'PC/Offences & misdemeanors to the security of the government (domestic)',
  },
  { key: 'PCTX', description: 'PC/Tax Crimes' },
  {
    key: 'PCTS',
    description: 'PC/Trafficking of human beings and migrant smuggling',
  },
  { key: 'PCTC', description: 'PC/Transnational organized crimes' },
  { key: 'PCU', description: 'PC/Unidentified' },
  {
    key: 'SPCCW',
    description:
      'SPC/Cash deposits are directly followed by withdrawals without an apparent reason',
  },
  {
    key: 'SPCCO',
    description:
      'SPC/Customer uses cash frequently or in large amounts while his/her field of business usually uses other payment methods (e.g. checks, ..)',
  },
  {
    key: 'SPCEL',
    description:
      'SPC/Depositing amounts in credit card account highly exceeding its credit limit',
  },
  {
    key: 'SPCLD',
    description: 'SPC/Exchange of currency into large denomination notes',
  },
  {
    key: 'SPCLM',
    description:
      "SPC/Exchanging large amounts of currency in a manner inconsistent with customer's business",
  },
  {
    key: 'SPCCT',
    description:
      "SPC/Large cash deposits followed by wire transfers not consistent with customer's business",
  },
  {
    key: 'SPCLC',
    description: 'SPC/Large cash deposits without an apparent reason',
  },
  {
    key: 'SPCAT',
    description:
      'SPC/Large cash deposits/withdrawals using ATMs in a way inconsistent with customer information',
  },
  {
    key: 'SPCSW',
    description:
      'SPC/Large sudden withdrawal (often in cash) without an apparent reason',
  },
  {
    key: 'SPCMC',
    description: 'SPC/Multiple cash deposits without an apparent reason',
  },
  {
    key: 'SPCMW',
    description: 'SPC/Multiple cash withdrawals without an apparent reason',
  },
  {
    key: 'SPCRD',
    description:
      'SPC/Repeated deposits or transfers to an account without an apparent reason',
  },
  {
    key: 'SPCCF',
    description:
      'SPC/Requesting credit against collaterals issued by foreign financial institutions without any apparent reason',
  },
  {
    key: 'SPCCA',
    description: 'SPC/Requesting credit against collaterals owned by others',
  },
  { key: 'SPCSD', description: 'SPC/Use of small denominations' },
  {
    key: 'SPFEX',
    description:
      'SPF/Credit card purchases involve stores selling chemicals known to be used in making explosives.',
  },
  {
    key: 'SPFVT',
    description: "SPF/Customer's behavior exhibiting violent tendencies",
  },
  {
    key: 'SPFEB',
    description:
      "SPF/Customer's behavior indicating adherence to extremist beliefs or ideas",
  },
  {
    key: 'SPFSC',
    description:
      'SPF/Purchase of expensive or sophisticated communication devices and information technology using credit card',
  },
  {
    key: 'SPFCE',
    description: 'SPF/Purchase of heavy camping equipment using credit card',
  },
  {
    key: 'SPFFT',
    description: 'SPF/Suspected to involve foreign terrorist fighters',
  },
  {
    key: 'SPFKT',
    description:
      'SPF/The customer is known to be related to terrorist group or organization',
  },
  {
    key: 'SPFSM',
    description:
      'SPF/Unusual financial use of social media (e.g. crowdfunding)',
  },
  {
    key: 'SPGLP',
    description:
      'SPG/Beneficiary of an LG requests paying its value after a short period of its issuance or without an apparent reason',
  },
  {
    key: 'SPGRI',
    description:
      'SPG/Customer repeatedly issued LGs in a way inconsistent with his/her business',
  },
  {
    key: 'SPGCI',
    description:
      "SPG/Opening LGs using collaterals inconsistent with customer's business",
  },
  { key: 'SPISP', description: 'SPI/Single premium life insurance policy' },
  {
    key: 'SPLGI',
    description:
      "SPL/Imported/ exported goods are inconsistent with customer's business",
  },
  {
    key: 'SPLUT',
    description: 'SPL/LC includes unusual terms without any apparent reason',
  },
  {
    key: 'SPLCU',
    description:
      "SPL/Opening LCs using collaterals inconsistent with customer's business",
  },
  {
    key: 'SPLAL',
    description:
      'SPL/The transaction involves the use of repeatedly amended or extended letters of credit without an apparent reason',
  },
  {
    key: 'SPLLI',
    description:
      "SPL/The use of LCs or other trade finance instruments in a way inconsistent with customer's business",
  },
  {
    key: 'SPNDN',
    description:
      'SPN/Repeated large deposits or transfers to the accounts of a newly founded or an unknown NPO',
  },
  {
    key: 'SPNNP',
    description:
      'SPN/Transactions conducted on the account of an NPO which are inconsistent with the pattern and size of the organization’s purpose or business',
  },
  {
    key: 'SPNHR',
    description:
      'SPN/Transfers from/to an NPO connected with a terrorism or terrorism financing high risk country',
  },
  {
    key: 'SPOAA',
    description:
      'SPO/Accounts abandoned by the customer after being used to conduct several transactions or transactions in large sums of money.',
  },
  {
    key: 'SPOAS',
    description: 'SPO/Activity conducted over a short time frame',
  },
  {
    key: 'SPTAR',
    description: 'SPO/Alternative money remittance or underground banking',
  },
  {
    key: 'SPOCC',
    description:
      'SPO/Customer contact details changes frequently without an apparent reason, or are incorrect or continuously non-operational.',
  },
  {
    key: 'SPORH',
    description:
      'SPO/Customer is a resident or connected to a high-risk jurisdiction.',
  },
  {
    key: 'SPOCS',
    description: 'SPO/Customer presenting obviously counterfeit documents',
  },
  {
    key: 'SPORU',
    description:
      'SPO/Customer repeatedly refused to update his/her CDD information and documents',
  },
  {
    key: 'SPOCO',
    description:
      'SPO/Customer requests not to receive correspondents from the financial institution',
  },
  {
    key: 'SPCTL',
    description:
      'SPO/Customer requests the transfer value of a loan/ credit facilities to other financial institutions without any apparent reason.',
  },
  {
    key: 'SPOCH',
    description:
      'SPO/Customer submitted cheques for collection inconsistent with his/her business or without apparent relation with the issuer.',
  },
  {
    key: 'SPOIT',
    description:
      'SPO/Customer’s appearance does not match with his/her inflated transactions.',
  },
  {
    key: 'SPOIN',
    description:
      'SPO/Customer’s income does not match with his/her inflated transactions.',
  },
  {
    key: 'SPTSA',
    description:
      'SPO/Customers (natural person) acquire several accounts for the purpose of receiving and/or sending transfers in relatively small values',
  },
  {
    key: 'SPOCZ',
    description:
      'SPO/Customers accessing their e-banking facilities or sending orders from an IP address within a conflict zone or address not associated with CDD records.',
  },
  {
    key: 'SPTIA',
    description:
      "SPO/Customer's account was used as an intermediary account to transfer money between two parties",
  },
  {
    key: 'SPOAW',
    description:
      'SPO/Customers opening an account in regions away from their work address or place of residence without an apparent reason',
  },
  {
    key: 'SPOUI',
    description:
      'SPO/Customers shows unusual interest in the reporting requirements, transactions thresholds or record-keeping requirements',
  },
  {
    key: 'SPOAO',
    description:
      'SPO/Customers suspected to conduct transactions or act on behalf of another individual',
  },
  {
    key: 'SPOAC',
    description:
      'SPO/Customers who deliberately avoid the direct contact with the financial institution',
  },
  {
    key: 'SPODL',
    description:
      'SPO/Daily using the maximum permitted limit of a payment card',
  },
  {
    key: 'SPOEQ',
    description:
      'SPO/Debit and credit transactions are almost equal in a short period of time',
  },
  {
    key: 'SPOER',
    description:
      'SPO/Early redemption of loan/ credit facilities by the customer or other parties',
  },
  {
    key: 'SPOFS',
    description:
      'SPO/Frequent purchase / sale of specific securities with no economic reason',
  },
  { key: 'SPOHJ', description: 'SPO/Involved high risk jurisdiction' },
  {
    key: 'SPOSC',
    description:
      'SPO/Issuance of several payment cards without an apparent reason',
  },
  { key: 'SPOTE', description: 'SPO/Manipulations for evading taxes' },
  {
    key: 'SPORI',
    description:
      'SPO/New customers who are reluctant to provide needed information',
  },
  {
    key: 'SPFBT',
    description:
      'SPO/Purchase of numerous airline or bus tickets without an apparent reason',
  },
  { key: 'SPOPS', description: 'SPO/Purchase of precious metals or stones' },
  {
    key: 'SPTLC',
    description:
      'SPO/Receiving large transfers accompanied by instructions to be paid in cash',
  },
  {
    key: 'SPOPR',
    description:
      'SPO/Related to a person that was previously reported to the FIU',
  },
  {
    key: 'SPTTC',
    description: 'SPO/Repeated or large transfers following cash deposits',
  },
  {
    key: 'SPTRH',
    description: 'SPO/Repeated or large transfers from high risk countries',
  },
  {
    key: 'SPOTC',
    description:
      "SPO/Repeated requests to issue traveller cheques or bearer negotiable instruments in a manner inconsistent with customer's business",
  },
  {
    key: 'SPOPC',
    description: 'SPO/Repeated transactions using payment cards',
  },
  { key: 'SPOS', description: 'SPO/Structuring' },
  { key: 'SPODO', description: 'SPO/Sudden use of dormant accounts' },
  {
    key: 'SPOSI',
    description:
      'SPO/Suspicion is related to a person listed in sanction lists (international)',
  },
  {
    key: 'SPOSL',
    description:
      'SPO/Suspicion is related to a person listed in sanction lists (local)',
  },
  {
    key: 'SPOPM',
    description: 'SPO/The customer is subject to provisional measures',
  },
  {
    key: 'SPOC',
    description:
      'SPO/The customer shows no interest in the costs of the transaction',
  },
  {
    key: 'SPOR',
    description:
      'SPO/The involved customer has a bad reputation all over the media',
  },
  {
    key: 'SPORE',
    description: 'SPO/The use of real estate finance / purchases',
  },
  { key: 'SPOBT', description: 'SPO/Transactions below reporting threshold' },
  {
    key: 'SPOHA',
    description: 'SPO/Transactions conducted in a high-risk local area',
  },
  { key: 'SPOEC', description: 'SPO/Transactions lacking an economic purpose' },
  { key: 'SPOUD', description: 'SPO/Ultimate disposition of funds is unknown' },
  {
    key: 'SPOUT',
    description:
      'SPO/Unexplained termination of the business relationship or contract',
  },
  { key: 'SPOUS', description: 'SPO/Unknown source of funds' },
  {
    key: 'SPOUB',
    description:
      "SPO/Unusual financial behaviour by one of the financial institution's employees.",
  },
  { key: 'SPOGA', description: 'SPO/Unusual gambling behavior' },
  { key: 'SPOSD', description: 'SPO/Unusual use of a safe deposit box' },
  {
    key: 'SPOMM',
    description: 'SPO/Unusual use of derivatives or money market instruments',
  },
  {
    key: 'SPOFM',
    description:
      'SPO/Use of a family member account without an apparent reason',
  },
  { key: 'SPODN', description: 'SPO/Use of accountants/ lawyers' },
  {
    key: 'SPODC',
    description: 'SPO/Use of different currencies without an apparent reason',
  },
  {
    key: 'SPOOF',
    description: 'SPO/Use of offshore entities/ arrangements/ accounts',
  },
  { key: 'SPOPB', description: 'SPO/Use of personal account for business' },
  { key: 'SPOSH', description: 'SPO/Use of shell company' },
  { key: 'SPOVC', description: 'SPO/Use of virtual currencies' },
  {
    key: 'SPTTR',
    description:
      'SPT/Transfers from/to customer without an apparent relation with the other party',
  },
  {
    key: 'STFP',
    description: 'ST/Financing the Polfiration of Weapons of Mass Destruction',
  },
  { key: 'STML', description: 'ST/Money Laundering' },
  { key: 'STPC', description: 'ST/Proceeds of crimes' },
  { key: 'STTF', description: 'ST/Terrorist Financing' },
]
