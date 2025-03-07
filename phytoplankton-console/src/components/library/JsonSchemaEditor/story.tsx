import React, { useState } from 'react';
import Component from './index';
import { UseCase } from '@/pages/storybook/components';
import { ExtendedSchema } from '@/components/library/JsonSchemaEditor/types';
import Select from '@/components/library/Select';
import Form from '@/components/library/Form';
import { getOrderedProps, makeValidators } from '@/components/library/JsonSchemaEditor/utils';

export default function (): JSX.Element {
  const [schemaIndex, setSchemaIndex] = useState(0);
  return (
    <>
      <UseCase title="Basic case">
        <div
          style={{
            marginBottom: '1rem',
            paddingBottom: '1rem',
            borderBottom: `1px solid var(--storybook-color-1)`,
            display: 'grid',
            alignItems: 'center',
            gap: '1rem',
            gridTemplateColumns: 'auto 1fr',
          }}
        >
          Select schema:
          <Select
            mode="SINGLE"
            value={`${schemaIndex}`}
            options={SAMPLE_SCHEMAS.map(([label], i) => ({ label: label, value: `${i}` }))}
            onChange={(value) => {
              if (value) {
                setSchemaIndex(parseInt(value));
              }
            }}
          />
        </div>
        <Form initialValues={{}}>
          <Component
            parametersSchema={SAMPLE_SCHEMAS[schemaIndex][1]}
            settings={{
              propertyNameStyle: 'SNAKE_CASE',
            }}
          />
        </Form>
      </UseCase>
      <UseCase title="Sample schema validation">
        {([state, setState]) => {
          const schema: ExtendedSchema = {
            type: 'object',
            required: ['array_field'],
            properties: {
              array_field: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    object_string_field: {
                      type: 'string',
                    },
                  },
                  required: ['object_string_field'],
                },
              },
            },
          };
          const props = getOrderedProps(schema);
          const fieldValidators = makeValidators(props);
          return (
            <>
              <Form
                initialValues={{}}
                alwaysShowErrors={true}
                fieldValidators={fieldValidators}
                onChange={(_values) => {
                  setState(_values);
                }}
              >
                <Component parametersSchema={schema} />
              </Form>
              <textarea rows={20} readOnly value={JSON.stringify(state, null, 4)} />
            </>
          );
        }}
      </UseCase>
    </>
  );
}

const SAMPLE_SCHEMAS: [string, ExtendedSchema][] = [
  [
    'All basic types',
    {
      'ui:schema': {
        'ui:order': ['number', 'number_with_limits', 'string', 'boolean'],
      },
      type: 'object',
      properties: {
        boolean: {
          type: 'boolean',
          title: 'Example boolean property',
          description: 'Example description',
        },
        number: {
          type: 'number',
          title: 'Example number property',
          description: 'Example description',
        },
        string: {
          type: 'string',
          title: 'Example string property',
          description: 'Example description',
        },
        number_with_limits: {
          multipleOf: 10,
          description: 'Example of a number field with minimum and maximum values',
          maximum: 100,
          'ui:schema': {},
          type: 'number',
          title: 'Example number property with limits',
          minimum: 0,
        },
      },
      required: ['boolean', 'number', 'number_with_limits', 'string'],
    },
  ],
  [
    'Required property',
    {
      'ui:schema': {
        'ui:order': ['number', 'string', 'boolean'],
      },
      type: 'object',
      properties: {
        f1: {
          type: 'number',
          title: 'Optional property',
        },
        f2: {
          type: 'number',
          title: 'Optional property (nullable)',
          nullable: true,
        },
        f3: {
          type: 'string',
          title: 'Required property',
        },
      },
      required: ['f2', 'f3'],
    },
  ],
  [
    'Subtype: DAY_WINDOW',
    {
      type: 'object',
      properties: {
        period: {
          'ui:schema': {
            'ui:subtype': 'DAY_WINDOW',
          },
          description: 'Reference period, should be larger than period1',
          type: 'object',
          title: 'Period property title',
          properties: {
            granularity: {
              type: 'string',
              title: 'Time granularity',
              enum: ['day'],
            },
            rollingBasis: {
              description:
                'With rolling basis, the time window looks back from the hit time by ‘N’ units. Without it, the window starts at the beginning of the selected unit and runs up to the hit time',
              type: 'boolean',
              title: 'Rolling basis',
              nullable: true,
            },
            units: {
              type: 'integer',
              title: 'Number of time unit',
              minimum: 0,
            },
          },
          required: ['units', 'granularity'],
        },
      },
      required: ['period'],
    },
  ],
  [
    'Subtype: TIME_WINDOW',
    {
      type: 'object',
      properties: {
        period: {
          'ui:schema': {
            'ui:subtype': 'TIME_WINDOW',
          },
          type: 'object',
          title: 'Time period',
          description: 'Select the time period from the dropdown',
          properties: {
            units: { type: 'integer', title: 'Number of time unit', minimum: 0 },
            granularity: {
              type: 'string',
              title: 'Time granularity',
              enum: ['second', 'minute', 'hour', 'day', 'week', 'month', 'year', 'fiscal_year'],
              enumNames: [
                'Second',
                'Minute',
                'Hour',
                'Day',
                'Week',
                'Month',
                'Year',
                'Fiscal year',
              ],
            },
            fiscalYear: {
              type: 'object',
              title: 'Fiscal year settings',
              description: 'Select the fiscal year from the dropdown',
              properties: {
                startMonth: {
                  type: 'integer',
                  title: 'Start month',
                  minimum: 1,
                  maximum: 12,
                },
                startDay: {
                  type: 'integer',
                  title: 'Start day',
                  minimum: 1,
                  maximum: 31,
                },
              },
              required: ['startMonth', 'startDay'],
            },
            rollingBasis: {
              type: 'boolean',
              title: 'Rolling basis',
              description:
                'With rolling basis, the time window looks back from the hit time by ‘N’ units. Without it, the window starts at the beginning of the selected unit and runs up to the hit time',
              nullable: true,
            },
          },
          required: ['units', 'granularity'],
        },
      },
    },
  ],
  [
    'Subtype: COUNTRIES',
    {
      type: 'object',
      properties: {
        country: {
          'ui:schema': {
            'ui:group': 'geography',
            'ui:subtype': 'COUNTRIES',
          },
          type: 'array',
          title: 'Countries',
          items: {
            type: 'string',
            enum: [
              'AF',
              'AL',
              'DZ',
              'AS',
              'AD',
              'AO',
              'AI',
              'AQ',
              'AG',
              'AR',
              'AM',
              'AW',
              'AU',
              'AT',
              'AZ',
              'BS',
              'BH',
              'BD',
              'BB',
              'BY',
              'BE',
              'BZ',
              'BJ',
              'BM',
              'BT',
              'BO',
              'BQ',
              'BA',
              'BW',
              'BV',
              'BR',
              'IO',
              'BN',
              'BG',
              'BF',
              'BI',
              'CV',
              'KH',
              'CM',
              'CA',
              'KY',
              'CF',
              'TD',
              'CL',
              'CN',
              'CX',
              'CC',
              'CO',
              'KM',
              'CD',
              'CG',
              'CK',
              'CR',
              'HR',
              'CU',
              'CW',
              'CY',
              'CZ',
              'CI',
              'DK',
              'DJ',
              'DM',
              'DO',
              'EC',
              'EG',
              'SV',
              'GQ',
              'ER',
              'EE',
              'SZ',
              'ET',
              'FK',
              'FO',
              'FJ',
              'FI',
              'FR',
              'GF',
              'PF',
              'TF',
              'GA',
              'GM',
              'GE',
              'DE',
              'GH',
              'GI',
              'GR',
              'GL',
              'GD',
              'GP',
              'GU',
              'GT',
              'GG',
              'GN',
              'GW',
              'GY',
              'HT',
              'HM',
              'VA',
              'HN',
              'HK',
              'HU',
              'IS',
              'IN',
              'ID',
              'IR',
              'IQ',
              'IE',
              'IM',
              'IL',
              'IT',
              'JM',
              'JP',
              'JE',
              'JO',
              'KZ',
              'KE',
              'KI',
              'KP',
              'KR',
              'KW',
              'KG',
              'LA',
              'LV',
              'LB',
              'LS',
              'LR',
              'LY',
              'LI',
              'LT',
              'LU',
              'MO',
              'MG',
              'MW',
              'MY',
              'MV',
              'ML',
              'MT',
              'MH',
              'MQ',
              'MR',
              'MU',
              'YT',
              'MX',
              'FM',
              'MD',
              'MC',
              'MN',
              'ME',
              'MS',
              'MA',
              'MZ',
              'MM',
              'NA',
              'NR',
              'NP',
              'NL',
              'NC',
              'NZ',
              'NI',
              'NE',
              'NG',
              'NU',
              'NF',
              'MK',
              'MP',
              'NO',
              'OM',
              'PK',
              'PW',
              'PS',
              'PA',
              'PG',
              'PY',
              'PE',
              'PH',
              'PN',
              'PL',
              'PT',
              'PR',
              'QA',
              'RO',
              'RU',
              'RW',
              'RE',
              'BL',
              'SH',
              'KN',
              'LC',
              'MF',
              'PM',
              'VC',
              'WS',
              'SM',
              'ST',
              'SA',
              'SN',
              'RS',
              'SC',
              'SL',
              'SG',
              'SX',
              'SK',
              'SI',
              'SB',
              'SO',
              'ZA',
              'GS',
              'SS',
              'ES',
              'LK',
              'SD',
              'SR',
              'SJ',
              'SE',
              'CH',
              'SY',
              'TW',
              'TJ',
              'TZ',
              'TH',
              'TL',
              'TG',
              'TK',
              'TO',
              'TT',
              'TN',
              'TM',
              'TC',
              'TV',
              'TR',
              'UG',
              'UA',
              'AE',
              'GB',
              'UM',
              'US',
              'UY',
              'UZ',
              'VU',
              'VE',
              'VN',
              'VG',
              'VI',
              'WF',
              'EH',
              'YE',
              'ZM',
              'ZW',
              'AX',
              'XA',
              'XB',
              'XC',
              'XD',
              'XE',
              'XF',
              'XG',
              'XH',
              'XI',
              'XJ',
              'XK',
              'XL',
              'XM',
              'XN',
              'XO',
              'XP',
              'XQ',
              'XR',
              'XS',
              'XT',
              'XU',
              'XV',
              'XW',
              'XY',
              'XZ',
            ],
          },
          uniqueItems: true,
          nullable: true,
        },
      },
    },
  ],
  [
    'Subtype: AGE_RANGE',
    {
      type: 'object',
      properties: {
        age: {
          type: 'object',
          title: 'User Age Range',
          'ui:schema': {
            'ui:subtype': 'AGE_RANGE',
          },
          properties: {
            minAge: {
              type: 'object',
              'ui:schema': {
                'ui:subtype': 'AGE',
              },
              title: 'Age',
              properties: {
                units: { type: 'integer', title: 'Number of time unit', minimum: 0 },
                granularity: {
                  type: 'string',
                  title: 'Time granularity',
                  enum: ['day', 'month', 'year'],
                  nullable: true,
                },
              },
              required: [],
              nullable: true,
            },
            maxAge: {
              type: 'object',
              'ui:schema': {
                'ui:subtype': 'AGE',
              },
              title: 'Age',
              properties: {
                units: { type: 'integer', title: 'Number of time unit', minimum: 0 },
                granularity: {
                  type: 'string',
                  title: 'Time granularity',
                  enum: ['day', 'month', 'year'],
                  nullable: true,
                },
              },
              required: [],
              nullable: true,
            },
          },
          required: [],
          nullable: true,
        },
      },
    },
  ],
  [
    'Subtype: TRANSACTION_AMOUNT_RANGE',
    {
      type: 'object',
      properties: {
        amountRange: {
          type: 'object',
          'ui:schema': {
            'ui:subtype': 'TRANSACTION_AMOUNT_RANGE',
          },
          title: 'Transaction Amount Range',
          additionalProperties: {
            type: 'object',
            properties: {
              max: {
                type: 'integer',
                nullable: true,
              },
              min: {
                type: 'integer',
                nullable: true,
              },
            },
          },
          required: [],
          nullable: true,
        },
      },
    },
  ],
  [
    'Age',
    {
      type: 'object',
      properties: {
        field: {
          type: 'object',
          'ui:subtype': 'AGE',
          title: 'Age property title',
          description: 'Age property description',
          properties: {
            units: { type: 'integer', title: 'Number of time unit', minimum: 0 },
            granularity: {
              type: 'string',
              title: 'Time granularity',
              enum: ['day', 'month', 'year'],
              nullable: true,
            },
          },
          required: [],
        },
      },
    },
  ],
  [
    'Additional properties',
    {
      type: 'object',
      properties: {
        stringsField: {
          type: 'object',
          title: 'Strings field',
          description: 'Object field with strings in additionalProperties',
          additionalProperties: {
            type: 'string',
          },
        },
        objectsField: {
          type: 'object',
          title: 'Objects field',
          description: 'Object field with objects in additionalProperties',
          additionalProperties: {
            type: 'object',
            properties: {
              f1: {
                title: 'Some string field',
                description: 'With description',
                type: 'string',
              },
              f2: {
                title: 'Another number field',
                description: 'Also can have description',
                type: 'number',
              },
            },
          },
        },
      },
    },
  ],
  [
    'Object with "oneOf"',
    {
      type: 'object',
      properties: {
        objectsField: {
          type: 'object',
          title: 'Objects field',
          description: 'Sample object field',
          properties: {
            stringsField: {
              type: 'object',
              title: 'Strings field',
              description: 'Shared field for subtypes',
            },
          },
          oneOf: [
            {
              type: 'object',
              title: 'To my client',
              properties: {
                to_name: {
                  type: 'string',
                },
              },
              required: ['to'],
            },
            {
              type: 'object',
              title: 'From my client',
              properties: {
                from_name: {
                  type: 'string',
                },
              },
              required: ['from'],
            },
            {
              type: 'object',
              properties: {
                f1: {
                  type: 'string',
                },
              },
              required: ['f1'],
            },
          ],
        },
      },
    },
  ],
  [
    'Arrays',
    {
      type: 'object',
      properties: {
        enumStringArray: {
          type: 'array',
          title: 'String array',
          description: 'This is an example of input for enum string array',
          items: {
            type: 'string',
          },
          required: [],
        },
        stringArray: {
          type: 'array',
          title: 'Enum string array',
          description: 'This is an example of input for enum string array',
          items: {
            type: 'string',
            enum: ['sending', 'all', 'none'],
          },
          required: [],
        },
        objectArray: {
          type: 'array',
          title: 'Age property title',
          description: 'This is an example of input for object array',
          items: {
            type: 'object',
            properties: {
              f1: {
                title: 'Some string field',
                description: 'With description',
                type: 'string',
              },
              f2: {
                title: 'Another number field',
                description: 'Also can have description',
                type: 'number',
              },
            },
          },
          required: [],
        },
      },
    },
  ],
  [
    'Example of actual schema',
    {
      'ui:schema': {
        'ui:order': [
          'period1',
          'period2',
          'excludePeriod1',
          'multiplierThreshold',
          'transactionsNumberThreshold',
          'transactionsNumberThreshold2',
          'valueThresholdPeriod1',
          'checkSender',
          'checkReceiver',
        ],
      },
      type: 'object',
      properties: {
        excludePeriod1: {
          type: 'boolean',
          title: 'Exclude transactions in period1 from period2',
          nullable: true,
        },
        checkSender: {
          description:
            "sending: only check the sender's past sending transactions; all: check the sender's past sending and receiving transactions; none: do not check the sender",
          type: 'string',
          title: 'Sender Transaction Direction to Check',
          enum: ['sending', 'all', 'none'],
        },
        period2: {
          'ui:subtype': 'DAY_WINDOW',
          type: 'object',
          title: 'period2 (Reference period, should be larger than period1)',
          properties: {
            granularity: {
              type: 'string',
              title: 'Time granularity',
              enum: ['day'],
            },
            rollingBasis: {
              description:
                'With rolling basis, the time window looks back from the hit time by ‘N’ units. Without it, the window starts at the beginning of the selected unit and runs up to the hit time',
              type: 'boolean',
              title: 'Rolling basis',
              nullable: true,
            },
            units: {
              type: 'integer',
              title: 'Number of time unit',
              minimum: 0,
            },
          },
          required: ['units', 'granularity'],
        },
        transactionsNumberThreshold: {
          type: 'object',
          title:
            "Rule doesn't trigger if transactions number in period1 in less than 'Min' or more than 'Max'",
          nullable: true,
          properties: {
            max: {
              type: 'integer',
              title: 'Max',
              nullable: true,
            },
            min: {
              type: 'integer',
              title: 'Min',
              nullable: true,
            },
          },
          required: [],
        },
        period1: {
          'ui:subtype': 'DAY_WINDOW',
          type: 'object',
          title: 'period1 (Current period)',
          properties: {
            granularity: {
              type: 'string',
              title: 'Time granularity',
              enum: ['day'],
            },
            rollingBasis: {
              description:
                'When rolling basis is disabled, system starts the time period at 00:00.',
              type: 'boolean',
              title: 'Rolling basis',
              nullable: true,
            },
            units: {
              type: 'integer',
              title: 'Number of time unit',
              minimum: 0,
            },
          },
          required: ['units', 'granularity'],
        },
        transactionsNumberThreshold2: {
          type: 'object',
          title:
            "Rule doesn't trigger if transactions number in period2 in less than 'Min' or more than 'Max'",
          nullable: true,
          properties: {
            max: {
              type: 'integer',
              title: 'Max',
              nullable: true,
            },
            min: {
              type: 'integer',
              title: 'Min',
              nullable: true,
            },
          },
          required: [],
        },
        valueThresholdPeriod1: {
          description:
            "Rule doesn't trigger if average transactions number in period1 in less than 'Min' or more than 'Max'",
          type: 'object',
          title: 'Average number threshold (period 1)',
          nullable: true,
          properties: {
            max: {
              type: 'number',
              title: 'Max',
              nullable: true,
              minimum: 0,
            },
            min: {
              type: 'number',
              title: 'Min',
              nullable: true,
              minimum: 0,
            },
          },
          required: [],
        },
        multiplierThreshold: {
          description:
            'For example, specifying 200 (%) means that period 1 average should be twice as big as period 2 average to trigger the rule',
          type: 'number',
          title: 'Maximum multiplier (as a percentage)',
          nullable: true,
          minimum: 0,
        },
        checkReceiver: {
          description:
            "receiving: only check the receiver's past receiving transactions; all: check the receiver's past sending and receiving transactions; none: do not check the receiver",
          default: 'all',
          type: 'string',
          title: 'Receiver Transaction Direction to Check',
          enum: ['receiving', 'all', 'none'],
        },
      },
      required: ['period1', 'period2', 'checkSender', 'checkReceiver', 'multiplierThreshold'],
    },
  ],
] as unknown as [string, ExtendedSchema][];
