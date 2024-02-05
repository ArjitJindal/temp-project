import { AnySchemaObject } from 'ajv'
import { COUNTRY_CODES } from '@/@types/openapi-internal-custom/CountryCode'
import { CURRENCY_CODES } from '@/@types/openapi-internal-custom/CurrencyCode'

/**
 * The following JSON schema was derived from this document:
 * https://goaml.frc.go.ke/goAML_Prod/Images/customization/goAML_Schema%20v4.0.2%2001-03-2021.pdf
 *
 * This playground was used extensively test the behaviour:
 * https://rjsf-team.github.io/react-jsonschema-form/
 */

const AddressTypes: { key: string; description: string }[] = [
  {
    key: 'B',
    description: 'Business',
  },
  {
    key: 'P',
    description: 'Private',
  },
  {
    key: 'O',
    description: 'Operational',
  },
  {
    key: 'R',
    description: 'Registered',
  },
]

const fromProperties = {
  from_funds_code: {
    $ref: '#/definitions/funds_code',
    title: 'Funds code',
    description: 'Type of funds used in initiating transaction',
  },
  from_funds_comment: {
    title: 'Funds comment',
    description: 'Description, if funds_code is “O” (Other).',
    type: 'string',
    maxLength: 255,
  },
  from_foreign_currency: {
    type: 'string',
    title: 'Foreign currency',
    description:
      'If the transaction is conducted in foreign currency, then specify the foreign currency details.',
    $ref: '#/definitions/t_foreign_currency',
  },
  // t_conductor: {
  //   title: 'Conductor',
  //   description: 'The person performing the transaction.',
  //   $ref: '#/definitions/t_person',
  // },
  from_country: {
    title: 'Currency',
    description: 'Country where transaction was initiated.',
    $ref: '#/definitions/country_code',
  },
  from_account: {
    $ref: '#/definitions/t_account',
  },
}

const toProperties = {
  to_funds_code: {
    title: 'Code',
    description: 'Disposition of funds',
    $ref: '#/definitions/funds_code',
  },
  to_funds_comment: {
    title: 'Comment',
    description: 'Description, if code is “O” (Other) or policy number.',
    type: 'string',
    maxLength: 255,
  },
  to_foreign_currency: {
    $ref: '#/definitions/t_foreign_currency',
    title: 'Foreign currency',
    description:
      'If the transaction is conducted in foreign currency, then specify the foreign currency details.',
  },
  to_country: {
    $ref: '#/definitions/country_code',
  },
  to_account: {
    title: 'To Account',
    $ref: '#/definitions/t_account_my_client',
  },
}

const entityProperties = {
  name: {
    title: 'Name',
    type: 'string',
    maxLength: 255,
    description: 'Name of Entity',
  },
  commercial_name: {
    title: 'Commercial Name',
    type: 'string',
    maxLength: 255,
    description: 'The "traded as" name of the entity',
  },
  incorporation_legal_form: {
    title: 'Incorporation legal form',
    type: 'string',
    description: 'The legal form of the entity',
    maxLength: 255,
  },
  incorporation_number: {
    title: 'Incorporation Number',
    type: 'number',
    maxLength: 50,
    description:
      'The registration number of the entity/"company" in the relevant authority (e.g. Chamber of Commerce)',
  },
  business: {
    title: 'Business',
    type: 'string',
    maxLength: 255,
    description: 'Business area of the entity',
  },
  phones: {
    title: 'Phones',
    type: 'array',
    items: {
      $ref: '#/definitions/t_phone',
    },
  },
  addresses: {
    title: 'Addresses',
    type: 'array',
    items: {
      $ref: '#/definitions/t_address',
    },
  },
  email: {
    title: 'Email',
    type: 'string',
    maxLength: 255,
  },
  url: {
    title: 'Website',
    type: 'string',
    maxLength: 255,
    description: 'Entity web address',
  },
  incorporation_state: {
    title: 'Incorporation state',
    type: 'string',
    maxLength: 255,
  },
  incorporation_country_code: {
    title: 'Country',
    type: 'string',
    enum: COUNTRY_CODES,
  },
  director_id: {
    title: 'Directors',
    description: 'Individuals authorized',
    type: 'array',
    items: {
      $ref: '#/definitions/t_person_my_client',
    },
  },
  incorporation_date: {
    title: 'Incorporation registration date',
    type: 'string',
    format: 'date',
  },
  business_closed: {
    title: 'Business closed',
    type: 'boolean',
    description: 'Boolean to indicate if the company is closed down',
  },
  date_business_closed: {
    title: 'Date business closed',
    type: 'string',
    format: 'date',
    description: 'If entity is closed then specify close date if any.',
  },
  tax_number: {
    title: 'Tax Number',
    type: 'string',
    maxLength: 100,
    description: 'The entity tax number',
  },
  tax_registration_number: {
    title: 'Tax Number',
    type: 'string',
    maxLength: 100,
    description: 'Registration number of the entity by the Tax auth.',
  },
  comments: {
    title: 'Comments',
    type: 'string',
    maxLength: 4000,
    description: 'Generic comments field',
  },
}

const accountProperties = {
  properties: {
    institution_name: {
      title: 'Institution name',
      type: 'string',
      maxLength: 255,
      description: 'The name of the Bank',
    },
    institution_code: {
      title: 'Institution code',
      type: 'string',
      maxLength: 50,
      description:
        'Institution Registration Number of License Code given by Regulator',
    },
    swift: {
      title: 'SWIFT',
      type: 'string',
      maxLength: 11,
      description: 'SWIFT code according to ISO 9362',
    },
    non_bank_institution: {
      title: 'Non-banking institution',
      type: 'boolean',
      description:
        'A flag to cover cases where the account belongs to non-banking institution',
    },
    branch: {
      title: 'Branch',
      type: 'string',
      maxLength: 255,
      description: 'Branch code or name',
    },
    account: {
      title: 'Account number',
      type: 'string',
      maxLength: 50,
      description: 'Account number',
    },
    currency_code: {
      title: 'Currency',
      $ref: '#/definitions/currency',
      description: 'Currency the account is kept in',
    },
    account_name: {
      title: 'Account name',
      type: 'string',
      maxLength: 255,
      description:
        'This is a free text field used to “Label” the account; for example a saving book account with anonymous owner, or an Entity account dedicated to Invoices, etc.',
    },
    iban: {
      title: 'IBAN',
      type: 'string',
      maxLength: 34,
      description: 'IBAN',
    },
    client_number: {
      title: 'Client number',
      description: 'Client number',
      type: 'string',
      maxLength: 30,
    },
    personal_account_type: {
      title: 'Personal account type',
      description: 'Account type',
      $ref: '#/definitions/account_type',
    },
    t_entity: {
      title: 'Business entity',
      description: 'Business entity owning the account',
      $ref: '#/definitions/t_entity',
    },
    signatory: {
      type: 'array',
      title: 'Signatory',
      description: 'Person(s) with access to the account.',
      items: {
        type: 'object',
        required: ['t_person'],
        properties: {
          is_primary: {
            title: 'Primary',
            description:
              'Identifies the primary account holder. Only one signatory may be marked as is_primary. Has to be ‘true’ when node is set.',
            type: 'boolean',
          },
          t_person: {
            title: 'Person',
            description:
              'Subnode holding detailed information about the signatory.',
            $ref: '#/definitions/t_person',
          },
          role: {
            title: 'Role',
            description:
              'Subnode holding enumeration about the role of current signatory with the account.',
            $ref: '#/definitions/account_person_role_type',
          },
        },
      },
    },
    opened: {
      title: 'Opened',
      description: 'Open account date',
      type: 'string',
      format: 'date',
    },
    closed: {
      title: 'Closed',
      description: 'Date account closed',
      type: 'string',
      format: 'date',
    },
    // balance: {
    //   title: 'Balance',
    //   type: 'number',
    //   description: 'The account balance after the transaction was conducted.',
    // },
    // date_balance: {
    //   title: 'Date',
    //   type: 'string',
    //   format: 'date',
    //   description:
    //     'A date field to specify the date of the reported balance. Application will show balance history',
    // },
    status_code: {
      $ref: '#/definitions/account_status_code',
      title: 'Status code',
      description: 'Account status when transaction was initiated',
    },
    // beneficiary: {
    //   type: 'string',
    //   maxLength: 50,
    //   title: 'Beneficiary',
    //   description: 'Ultimate beneficiary of the account',
    // },
    // beneficiary_comment: {
    //   title: 'Beneficiary comment',
    //   description: 'Any special remark on the beneficiary',
    //   type: 'string',
    //   maxLength: 255,
    // },
    comments: {
      title: 'Comments',
      description: 'Generic comments elements',
      type: 'string',
      maxLength: 4000,
    },
  },
}

const personProperties = {
  gender: {
    title: 'Gender',
    type: 'string',
    enum: ['M', 'F'],
  },
  title: {
    type: 'string',
    title: 'Title',
    maxLength: 30,
  },
  first_name: {
    type: 'string',
    maxLength: 100,
    title: 'First name',
  },
  middle_name: {
    title: 'Middle name',
    type: 'string',
    maxLength: 100,
  },
  prefix: {
    title: 'Prefix name',
    type: 'string',
    maxLength: 100,
  },
  last_name: {
    title: 'Last name',
    type: 'string',
    maxLength: 100,
  },
  birthdate: {
    title: 'Birth date',
    type: 'string',
    format: 'date',
  },
  birth_place: {
    title: 'Place of birth',
    type: 'string',
    maxLength: 255,
  },
  mothers_name: {
    title: 'Mothers name',
    description:
      'Can be used as father, mother, second name, Other name, etc. as per country’s regulation',
    type: 'string',
    maxLength: 100,
  },
  alias: {
    title: 'Alias',
    type: 'string',
    description: 'Alias, Known As, ..etc',
    maxLength: 100,
  },
  ssn: {
    title: 'SSN',
    description: 'Social Security Number',
    type: 'string',
    maxLength: 25,
  },
  passport_number: {
    title: 'No. of passport',
    type: 'string',
    maxLength: 25,
  },
  passport_country: {
    title: 'Passport issue country',
    description: 'Can be reported only when there is a passport number',
    type: 'string',
    maxLength: 25,
  },
  id_number: {
    type: 'string',
    title: 'ID Number',
    description: 'Kenya National Identification number',
    maxLength: 25,
  },
  nationality1: {
    title: 'Country of Nationality (1)',
    type: 'string',
    enum: COUNTRY_CODES,
  },
  nationality2: {
    title: 'Country of Nationality (2)',
    type: 'string',
    enum: COUNTRY_CODES,
  },
  nationality3: {
    title: 'Country of Nationality (3)',
    type: 'string',
    enum: COUNTRY_CODES,
  },
  residence: {
    title: 'Country of residence',
    type: 'string',
    enum: COUNTRY_CODES,
  },
  phones: {
    title: 'Phones',
    type: 'array',
    items: {
      $ref: '#/definitions/t_phone',
    },
  },
  addresses: {
    title: 'Addresses',
    type: 'array',
    items: {
      $ref: '#/definitions/t_address',
    },
  },
  email: {
    title: 'Email address',
    type: 'string',
    format: 'email',
    maxLength: 255,
  },
  occupation: {
    title: 'Occupation',
    type: 'string',
    maxLength: 255,
  },
  employer_name: {
    title: 'Employer’s name',
    type: 'string',
    maxLength: 255,
  },
  employer_address_id: {
    title: 'Employer’s address',
    $ref: '#/definitions/t_address',
  },
  employer_phone_id: {
    title: 'Employer’s phone',
    $ref: '#/definitions/t_phone',
  },
  identification: {
    title: 'Identifications',
    type: 'array',
    items: {
      $ref: '#/definitions/t_person_identification',
    },
  },
  deceased: {
    title: 'Deceased',
    description: 'A Boolean to indicated if person has passed away',
    type: 'boolean',
  },
  date_deceased: {
    title: 'Date deceased',
    description:
      'If deceased, then RE can report deceased date if known as well',
    type: 'string',
    format: 'date',
  },
  tax_number: {
    title: 'Tax number',
    description: 'KRA Personal Identification Number eg A012345678A',
    type: 'string',
    maxLength: 100,
  },
  tax_reg_number: {
    title: 'Tax registration number',
    description: 'The person tax reg. number by tax auth.',
    type: 'string',
    maxLength: 100,
  },
  source_of_wealth: {
    type: 'string',
    title: 'Source of wealth',
    description: 'Free text description of the person source of wealth',
    maxLength: 255,
  },
  comments: {
    title: 'Comments',
    type: 'string',
    description: 'Relationship to the ACCOUNT HOLDER',
    maxLength: 4000,
  },
}

const Definitions: AnySchemaObject = {
  t_address: {
    title: 'Address',
    type: 'object',
    required: ['address_type', 'address', 'city', 'country_code'],
    properties: {
      address_type: {
        title: 'Address Type',
        type: 'string',
        enum: AddressTypes.map((a) => a.key),
        description: 'The contact type of the address',
      },
      address: {
        title: 'Address',
        type: 'string',
        maxLength: 100,
        description: 'Street name and house number',
      },
      town: {
        title: 'Town',
        type: 'string',
        maxLength: 255,
        description: 'Name of Town/district/.. as part of a City',
      },
      city: {
        title: 'City',
        type: 'string',
        maxLength: 255,
      },
      zip: {
        title: 'Zip Code',
        type: 'string',
        maxLength: 10,
      },
      country_code: {
        title: 'Country',
        type: 'string',
        enum: COUNTRY_CODES,
      },
      state: {
        title: 'State',
        type: 'string',
        maxLength: 255,
      },
      comments: {
        title: 'Comments',
        type: 'string',
        maxLength: 4000,
        description: 'Generic comments',
      },
    },
  },
  t_entity_my_client: {
    type: 'object',
    title: 'Entity details',
    required: [
      'name',
      'commercial_name',
      'incorporation_legal_form',
      'incorporation_number',
      'business',
      'incorporation_country_code',
      'director_id',
      'tax_number',
    ],
    properties: entityProperties,
  },
  t_entity: {
    title: 'Entity details',
    type: 'object',
    required: ['name', 'address'],
    properties: entityProperties,
  },
  report_party_type: {
    type: 'object',
    title: 'Reporting party',
    properties: {
      significance: {
        type: 'number',
        title: 'Significance',
        description: 'The significance of the subject in the report',
      },
      reason: {
        type: 'string',
        maxLength: 4000,
        title: 'Reason',
        description: 'Why the subject is involved in the current report',
        'ui:schema': { 'ui:subtype': 'NARRATIVE' },
      },
      comments: {
        type: 'string',
        title: 'Comments',
        description: 'Generic comments element',
        maxLength: 4000,
      },
      account: {
        $ref: '#/definitions/t_account',
      },
    },
    // oneOf: [
    //   {
    //     type: 'object',
    //     title: 'Person',
    //     required: ['person'],
    //     properties: {
    //       person: {
    //         $ref: '#/definitions/t_person',
    //       },
    //     },
    //   },
    //   {
    //     type: 'object',
    //     title: 'Account',
    //     required: ['account'],
    //     properties: {
    //       account: {
    //         $ref: '#/definitions/t_account',
    //       },
    //     },
    //   },
    //   {
    //     type: 'object',
    //     title: 'Entity',
    //     required: ['entity'],
    //     properties: {
    //       entity: {
    //         $ref: '#/definitions/t_entity',
    //       },
    //     },
    //   },
    // ],
  },
  t_person_my_client: {
    type: 'object',
    title: 'Person details',
    required: ['first_name', 'last_name'],
    properties: personProperties,
  },
  t_person: {
    type: 'object',
    title: 'Person details',
    required: [],
    properties: personProperties,
  },
  t_from: {
    type: 'object',
    title: 'From details',
    required: ['from_funds_code'],
    properties: fromProperties,
    // oneOf: [
    //   {
    //     type: 'object',
    //     title: 'Account',
    //     required: ['from_account'],
    //     properties: {
    //       from_account: {
    //         $ref: '#/definitions/t_account',
    //       },
    //     },
    //   },
    // {
    //     type: 'object',
    //   title: 'Person',
    //   required: ['from_person'],
    //   properties: {
    //     from_person: {
    //       $ref: '#/definitions/t_person',
    //     },
    //   },
    // },
    // {
    //     type: 'object',
    //   title: 'Entity',
    //   required: ['from_entity'],
    //   properties: {
    //     from_entity: {
    //       $ref: '#/definitions/t_entity',
    //     },
    //   },
    // },
    // ],
  },
  account_status_code: {
    type: 'string',
    title: 'Account status code',
    enum: ['A', 'B', 'C', 'FZ'],
  },
  identifier_type: {
    type: 'string',
    title: 'Identifier type',
    enum: ['ALIEN', 'BRTC', 'A', 'MLTC', 'B', 'D', 'C', 'URC'],
  },
  conduction_type: {
    title: 'Conduction type',
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
    title: 'Transaction item status',
    type: 'string',
    enum: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
  },
  contact_type: {
    title: 'Contract type',
    type: 'string',
    enum: ['B', 'P', 'O', 'R'],
  },
  communication_type: {
    title: 'Communication type',
    type: 'string',
    enum: ['L', 'M', 'F', 'S', 'P'],
  },
  entity_legal_form_type: {
    title: 'Entity legal form type',
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
    title: 'Transaction item type',
    type: 'string',
    enum: ['E', 'F', '1', 'J', 'P', 'V', 'W'],
  },
  currency: {
    title: 'Currency',
    type: 'string',
    enum: CURRENCY_CODES,
  },
  country_code: {
    title: 'Country code',
    type: 'string',
    enum: COUNTRY_CODES,
  },
  account_person_role_type: {
    title: 'Account person role',
    type: 'string',
    enum: ['AAGNT', 'GD', 'NM', 'PA', 'A', 'SSRL', 'TRST'],
  },
  entity_person_role_type: {
    title: 'Entity person role',
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
    title: 'Funds code',
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
    title: 'Account type',
    enum: ['KeB', 'keFD', 'KeG', 'KeL', 'KeM', 'KeP', 'AGNT', 'CDS', 'ESC'],
  },
  t_account_my_client: {
    type: 'object',
    title: 'Account details',
    required: [
      'institution_name',
      'account',
      'currency_code',
      'account_name',
      'personal_account_type',
      'signatory',
      't_entity',
      'role',
      'opened',
      'status_code',
    ],
    ...accountProperties,
  },
  t_from_my_client: {
    type: 'object',
    title: 'From details',
    required: ['from_funds_code'],
    properties: fromProperties,
    // oneOf: [
    // {
    //     type: 'object',
    //   required: ['from_account'],
    //   title: 'Account',
    //   properties: {
    //     from_account: {
    //       $ref: '#/definitions/t_account_my_client',
    //     },
    //   },
    // },
    // {
    //     type: 'object',
    //   required: ['from_person'],
    //   title: 'Person',
    //   properties: {
    //     from_person: {
    //       $ref: '#/definitions/t_person_my_client',
    //     },
    //   },
    // },
    // {
    //     type: 'object',
    //   required: ['from_entity'],
    //   title: 'Entity',
    //   properties: {
    //     from_entity: {
    //       $ref: '#/definitions/t_entity_my_client',
    //     },
    //   },
    // },
    // ],
  },
  t_to: {
    type: 'object',
    title: 'To details',
    required: ['to_funds_code', 'to_country'],
    properties: toProperties,
    // anyOf: [
    //   {
    //     required: ['to_account'],
    //     title: 'Account',
    //     properties: {
    //       to_account: {
    //         $ref: '#/definitions/t_account',
    //       },
    //     },
    //   },
    //   {
    //     required: ['to_person'],
    //     title: 'Person',
    //     properties: {
    //       to_person: {
    //         $ref: '#/definitions/t_person',
    //       },
    //     },
    //   },
    //   {
    //     required: ['to_entity'],
    //     title: 'Entity',
    //     properties: {
    //       to_entity: {
    //         $ref: '#/definitions/t_entity',
    //       },
    //     },
    //   },
    // ],
  },
  t_to_my_client: {
    title: 'To details',
    type: 'object',
    required: [],
    properties: toProperties,
    // oneOf: [
    // {
    //     type: 'object',
    //   required: ['to_account'],
    //   properties: {
    //     to_account: {
    //       title: 'To Account',
    //       $ref: '#/definitions/t_account_my_client',
    //     },
    //   },
    // },
    // {
    //     type: 'object',
    //   required: ['to_person'],
    //   properties: {
    //     to_person: {
    //       title: 'To Person',
    //       type: {
    //         $ref: '#/definitions/t_person_my_client',
    //       },
    //     },
    //   },
    // },
    // {
    //     type: 'object',
    //   required: ['to_entity'],
    //   properties: {
    //     to_entity: {
    //       title: 'To Entity',
    //       type: {
    //         $ref: '#/definitions/t_entity_my_client',
    //       },
    //     },
    //   },
    // },
    // ],
  },
  t_party: {
    title: 'Party',
    type: 'object',
    required: ['role', 'country'],
    properties: {
      role: {
        $ref: '#/definitions/account_person_role_type',
        title: 'Role',
        description: 'Subject role in the transaction',
      },
      funds_code: {
        title: 'Funds code',
        description: 'Type of funds used in initiating transaction',
        $ref: '#/definitions/funds_code',
      },
      funds_comment: {
        title: 'Funds comment',
        description: 'Description, if funds_code is “O” (Other).',
        type: 'string',
        maxLength: 255,
      },
      foreign_currency: {
        title: 'Foreign currency',
        description:
          'If the transaction is conducted in foreign currency, then specify the foreign currency details.',
        $ref: '#/definitions/t_foreign_currency',
      },
      country: {
        title: 'Country',
        $ref: '#/definitions/country_code',
        description: 'Country of the transaction',
      },
      significance: {
        type: 'number',
        title: 'Significance',
        description: 'The significance of the subject in the transaction',
      },
      comments: {
        type: 'string',
        title: 'Comments',
        description: 'Generic comments',
        maxLength: 4000,
      },
      account: {
        $ref: '#/definitions/t_account',
      },
    },
    // oneOf: [
    // {
    //     type: 'object',
    //   required: ['person'],
    //   properties: {
    //     person: {
    //       $ref: '#/definitions/t_person',
    //     },
    //   },
    // },
    // {
    //     type: 'object',
    //   required: ['person_my_client'],
    //   properties: {
    //     person_my_client: {
    //       $ref: '#/definitions/t_person_my_client',
    //     },
    //   },
    // },
    // {
    //     type: 'object',
    //   required: ['account'],
    //   properties: {
    //     account: {
    //       $ref: '#/definitions/t_account',
    //     },
    //   },
    // },
    // {
    //   required: ['account_my_client'],
    //   properties: {
    //     account_my_client: {
    //       $ref: '#/definitions/t_account_my_client',
    //     },
    //   },
    // },
    // {
    //   required: ['entity'],
    //   properties: {
    //     entity: {
    //       $ref: '#/definitions/t_entity',
    //     },
    //   },
    // },
    // {
    //   required: ['entity_my_client'],
    //   properties: {
    //     entity_my_client: {
    //       $ref: '#/definitions/t_entity_my_client',
    //     },
    //   },
    // },
    // ],
  },
  t_account: {
    type: 'object',
    title: 'Account details',
    required: ['account'],
    ...accountProperties,
  },
  t_phone: {
    type: 'object',
    title: 'Phone',
    required: ['tph_contact_type', 'tph_communication_type', 'tph_number'],
    properties: {
      tph_contact_type: {
        title: 'Contact type',
        description: 'The contact type of the Phone',
        $ref: '#/definitions/contact_type',
      },
      tph_communication_type: {
        title: 'Communication type',
        description: 'The communication type of the Phone',
        $ref: '#/definitions/communication_type',
      },
      tph_country_prefix: {
        title: 'Country phone code',
        type: 'string',
        enum: COUNTRY_CODES,
      },
      tph_number: {
        title: 'Phone number',
        type: 'string',
        maxLength: 50,
      },
      tph_extension: {
        title: "Phone's extension",
        type: 'string',
        maxLength: 10,
      },
      comments: {
        title: 'Generic comments',
        type: 'string',
        maxLength: 4000,
      },
    },
  },
  t_foreign_currency: {
    type: 'object',
    required: [
      'foreign_currency_code',
      'foreign_amount',
      'foreign_exchange_range',
    ],
    properties: {
      foreign_currency_code: {
        title: 'Currency code',
        description: 'Currency Code according to ISO 4217',
        $ref: '#/definitions/currency',
      },
      foreign_amount: {
        title: 'Foreign amount',
        description: 'Transaction amount in foreign currency',
        type: 'number',
      },
      foreign_exchange_rate: {
        title: 'Foreign exchange rate',
        description: 'Exchange rate which has been used for transaction',
        type: 'number',
      },
    },
  },
  t_person_identification: {
    type: 'object',
    title: 'Identification',
    required: ['type', 'number', 'issue_country'],
    properties: {
      type: {
        title: 'Document type',
        $ref: '#/definitions/identifier_type',
      },
      number: {
        description: 'ID of the identification document',
        title: 'ID',
        type: 'string',
        maxLength: 255,
      },
      issue_date: {
        title: 'Issue date',
        description: 'Identification document issue date',
        type: 'string',
        format: 'date',
      },
      expiry_date: {
        title: 'Expiry date',
        description: 'Identification document expiry date',
        type: 'string',
        format: 'date',
      },
      issued_by: {
        title: 'Issued by',
        description: 'Name of Authority issued the document',
        type: 'string',
        maxLength: 255,
      },
      issued_country: {
        title: 'Issued country',
        description: 'Country where the document was issued',
        $ref: '#/definitions/country_code',
      },
      comments: {
        title: 'Comments',
        description: 'Generic comments field',
        type: 'string',
        maxLength: 4000,
      },
    },
  },
  t_person_registration_in_report: {
    type: 'object',
    required: ['first_name', 'last_name'],
    properties: personProperties,
  },
  t_trans_item: {
    type: 'object',
    title: 'Transaction item',
    required: ['item_type'],
    properties: {
      item_type: {
        title: 'Item type',
        description: 'Lookup code describes the item type',
        type: 'string',
        enum: ['C', 'L'],
      },
      item_make: {
        title: 'Make',
        description: 'Item maker',
        type: 'string',
        maxNumber: 255,
      },
      description: {
        title: 'Description',
        type: 'string',
        maxNumber: 4000,
      },
      previously_registered_to: {
        title: 'Name of previous owner',
        type: 'string',
        maxNumber: 500,
      },
      presently_registered_to: {
        title: 'Name of current owner',
        type: 'string',
        maxNumber: 500,
      },
      estimated_value: {
        title: 'Estimated value',
        description: 'Estimated value of the property.',
        type: 'number',
      },
      status_code: {
        title: 'Status code',
        description: 'Goods Status as at the time of Transaction',
        $ref: '#/definitions/account_status_code',
      },
      status_comments: {
        title: 'Status comments',
        type: 'string',
        maxNumber: 500,
      },
      disposed_value: {
        title: 'Disposed value',
        description: 'Fffective value for property transfer',
        type: 'number',
      },
      currency_code: {
        title: 'Currency',
        description: 'Used to report service conducted in foreign currency',
        $ref: '#/definitions/currency',
      },
      size: {
        title: 'Size',
        description: 'Size of the property',
        type: 'number',
      },
      size_uom: {
        title: 'Unit of measurement',
        type: 'string',
        description: 'Unit of measurement',
        maxNumber: 250,
      },
      address: {
        title: 'Address',
        description: 'Address of the property',
        $ref: '#/definitions/t_address',
      },
      registration_date: {
        type: 'string',
        title: 'Official registration date',
        format: 'date',
      },
      registration_number: {
        title: 'Official registration number',
        type: 'string',
        maxLength: 500,
      },
      identification_number: {
        title: 'Identification number',
        type: 'string',
        description: 'Any number that can identify the item',
        maxLength: 255,
      },
      comments: {
        title: 'Comments',
        type: 'string',
        maxLength: 4000,
      },
    },
  },
}

export const KenyaTransactionSchema: AnySchemaObject = {
  type: 'object',
  required: ['transactionnumber', 't_from_my_client', 't_to_my_client'],
  properties: {
    transactionnumber: {
      type: 'string',
      title: 'Transaction number',
      maxLength: 50,
      description: 'Unique transaction number assigned to a transaction',
      'ui:schema': {
        'ui:scope': 'General information',
      },
    },
    internal_ref_number: {
      type: 'string',
      maxLength: 50,
      title: 'Internal ref number',
      description: 'Reporting Entity internal transaction reference number',
      'ui:schema': {
        'ui:scope': 'General information',
      },
    },
    // transaction_location: {
    //   type: 'string',
    //   maxLength: 255,
    //   title: 'Location',
    //   description: 'Branch/Location where the transaction took place',
    // },
    transaction_description: {
      type: 'string',
      title: 'Description',
      description: 'Free text field to describe the purpose of the transaction',
      maxLength: 4000,
      'ui:schema': {
        'ui:scope': 'General information',
      },
    },
    date_transaction: {
      type: 'string',
      title: 'Transaction date',
      description: 'Date and time of the transaction',
      format: 'date-time',
      'ui:schema': {
        'ui:scope': 'General information',
      },
    },
    // teller: {
    //   type: 'string',
    //   title: 'Teller',
    //   maxLength: 20,
    //   description: 'Bank staff who conducted the transaction',
    // },
    // authorized: {
    //   type: 'string',
    //   title: 'Authorized',
    //   maxLength: 20,
    //   description: 'Bank staff who authorized the transaction',
    // },
    // late_deposit: {
    //   title: 'Late deposit indicator',
    //   type: 'boolean',
    // },
    // date_posting: {
    //   title: 'Date of Posting',
    //   description: 'If different from date of transaction',
    //   type: 'string',
    //   format: 'date',
    // },
    // value_date: {
    //   type: 'string',
    //   title: 'Value date',
    //   format: 'date',
    //   description:
    //     'The actual date when the money will be credited (For example, Value date of a cheque)',
    // },
    transmode_code: {
      $ref: '#/definitions/conduction_type',
      title: 'Transmode code',
      description:
        'How the transaction was conducted ie the Transaction Method',
      'ui:schema': {
        'ui:subtype': 'NARRATIVE',
        'ui:scope': 'General information',
      },
    },
    transmode_comment: {
      type: 'string',
      title: 'Transmode comment',
      maxLength: 50,
      description: 'More information on the Transaction Method',
      'ui:schema': {
        'ui:subtype': 'NARRATIVE',
        'ui:scope': 'General information',
      },
    },
    amount_local: {
      type: 'number',
      title: 'Amount local',
      description: 'The value of the transaction in local currency',
      'ui:schema': {
        'ui:scope': 'General information',
      },
    },
    goods_services: {
      type: 'array',
      title: 'Goods/Services',
      description: 'The goods/services linked to the transaction',
      items: {
        $ref: '#/definitions/t_trans_item',
      },
      'ui:schema': {
        'ui:scope': 'General information',
      },
    },
    comments: {
      type: 'string',
      title: 'Comments',
      description: 'Free text field to describe the source of Funds',
      maxLength: 4000,
      'ui:schema': {
        'ui:scope': 'General information',
      },
    },
    t_from_my_client: {
      $ref: '#/definitions/t_from_my_client',
      'ui:schema': {
        'ui:scope': 'Transaction sender',
      },
    },
    t_to_my_client: {
      $ref: '#/definitions/t_to_my_client',
      'ui:schema': {
        'ui:scope': 'Transaction receiver',
      },
    },
  },
  definitions: Definitions,
}

export const KenyaReportSchema: AnySchemaObject = {
  type: 'object',
  required: [
    'reentity_id',
    'submission_code',
    'report_code',
    'currency_code_local',
    'reporting_person',
  ],
  properties: {
    reentity_id: {
      title: 'Reentity ID',
      description:
        'Reporting Entity number assigned to Registered Reporting Institution',
      type: 'string',
      maxLength: 20,
      'ui:schema': {
        'ui:group': 'Reporting entity details',
      },
    },
    reentity_branch: {
      title: 'Reentity branch',
      description: 'Branch of current reporting entity.',
      type: 'string',
      maxLength: 255,
      'ui:schema': {
        'ui:group': 'Reporting entity details',
      },
    },
    submission_code: {
      title: 'Submission code',
      type: 'string',
      enum: ['E', 'M'],
      'ui:schema': {
        'ui:group': 'Report details',
      },
    },
    // report_code: {
    //   title: 'Report code',
    //   type: 'string',
    //   $ref: '#/definitions/report_code',
    // },
    entity_reference: {
      title: 'Entity reference',
      type: 'string',
      description:
        'Optional reference to the report, used by reporting entity to uniquely identify the specific report',
      maxLength: 255,
      'ui:schema': {
        'ui:group': 'Reporting entity details',
      },
    },
    fiu_ref_number: {
      title: 'FIU reference number',
      type: 'string',
      maxLength: 255,
      description:
        'Optional ref. number to be used as communication channel between the FRC and the Reporting Entity',
      'ui:schema': {
        'ui:group': 'Report details',
      },
    },
    currency_code_local: {
      title: 'Currency code',
      $ref: '#/definitions/currency',
      description: 'Local Currency code',
      'ui:schema': {
        'ui:group': 'Report details',
      },
    },
    reporting_person: {
      title: 'Reporting person',
      $ref: '#/definitions/t_person_registration_in_report',
      description: 'Full details of the report’s reporting person',
      'ui:schema': {
        'ui:group': 'Reporting person details',
      },
    },
    location: {
      title: 'Location',
      $ref: '#/definitions/t_address',
      description: 'Describes location of the reported report',
      'ui:schema': {
        'ui:group': 'Report details',
      },
    },
    reason: {
      title: 'Reason',
      type: 'string',
      maxLength: 4000,
      description: 'Description of suspicious Activity or Transaction',
      'ui:schema': {
        'ui:group': 'Report details',
      },
    },
    action: {
      title: 'Action',
      type: 'string',
      maxLength: 4000,
      description: 'Describes the Basic of Suspicion',

      'ui:schema': {
        'ui:group': 'Report details',
      },
    },
  },
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
