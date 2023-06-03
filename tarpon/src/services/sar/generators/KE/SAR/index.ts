import * as xml2js from 'xml2js'
import { ReportGenerator } from '../..'
import { Report1 } from './schema'
import { Case } from '@/@types/openapi-internal/Case'
import { ReportSchema } from '@/@types/openapi-internal/ReportSchema'
import { Account } from '@/@types/openapi-internal/Account'

type KenyaSarData = Report1

export class KenyaSARReportGenerator implements ReportGenerator<KenyaSarData> {
  // TODO: Fix types
  public static getSchema(): any {
    return {
      title: 'report',
      type: 'object',
      definitions: {
        goods_services: {
          type: 'array',
          items: {
            $ref: '#/definitions/t_trans_item',
          },
        },
        t_account_my_client: {
          type: 'object',
          properties: {
            account: {
              type: 'string',
            },
            balance: {
              type: 'number',
            },
            date_balance: {
              type: 'string',
            },
            t_entity: {
              $ref: '#/definitions/t_entity',
            },
          },
          dependentRequired: {
            balance: ['date_balance'],
          },
          oneOf: [
            {
              title: 'institution_code',
              type: 'string',
            },
            {
              title: 'swift',
              type: 'string',
            },
          ],
        },
        t_from_my_client: {
          type: 'object',
          properties: {
            from_funds_codes: {
              type: 'string',
            },
          },
          oneOf: [
            {
              title: 'from_account',
              $ref: '#/definitions/t_account',
            },
            {
              title: 'from_person',
              $ref: '#/definitions/t_person',
            },
            {
              title: 'from_entity',
              $ref: '#/definitions/t_entity',
            },
          ],
        },
        t_to: {
          type: 'object',
          properties: {
            to_funds_codes: {
              type: 'string',
            },
          },
          oneOf: [
            {
              title: 'to_account',
              $ref: '#/definitions/t_account',
            },
            {
              title: 'to_person',
              $ref: '#/definitions/t_person',
            },
            {
              title: 'to_entity',
              $ref: '#/definitions/t_entity',
            },
          ],
        },
        t_to_my_client: {
          type: 'object',
          properties: {
            to_funds_codes: {
              type: 'string',
            },
          },
          oneOf: [
            {
              title: 'to_account',
              $ref: '#/definitions/t_account',
            },
            {
              title: 'to_person',
              $ref: '#/definitions/t_person',
            },
            {
              title: 'to_entity',
              $ref: '#/definitions/t_entity',
            },
          ],
        },
        t_from: {
          type: 'object',
          properties: {
            from_funds_codes: {
              type: 'string',
            },
          },
          oneOf: [
            {
              title: 'from_account',
              $ref: '#/definitions/t_account',
            },
            {
              title: 'from_person',
              $ref: '#/definitions/t_person',
            },
            {
              title: 'from_entity',
              $ref: '#/definitions/t_entity',
            },
          ],
        },
        t_account: {
          type: 'object',
          properties: {
            account: {
              type: 'string',
            },
            balance: {
              type: 'number',
            },
            date_balance: {
              type: 'string',
            },
            t_entity: {
              $ref: '#/definitions/t_entity',
            },
          },
          dependentRequired: {
            balance: ['date_balance'],
          },
          oneOf: [
            {
              title: 'institution_code',
              type: 'string',
            },
            {
              title: 'swift',
              type: 'string',
            },
          ],
        },
        t_entity: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
            },
          },
        },
        t_entity_my_client: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
            },
          },
        },
        t_person_my_client: {
          type: 'object',
          properties: {
            first_name: {
              type: 'string',
            },
          },
        },
        t_person: {
          type: 'object',
          properties: {
            first_name: {
              type: 'string',
            },
          },
        },
        t_person_registration_in_report: {
          type: 'object',
          properties: {
            first_name: {
              type: 'string',
            },
          },
        },
        t_address: {
          type: 'object',
          properties: {
            address: {
              type: 'string',
            },
          },
        },

        t_trans_item: {
          type: 'object',
          properties: {
            item_type: {
              type: 'string',
            },
            address: {
              $ref: '#/definitions/t_address',
            },
          },
        },
        t_phone: {
          type: 'object',
          properties: {
            tph_number: {
              type: 'string',
            },
          },
        },
        t_foreign_currency: {
          type: 'object',
          properties: {
            foreign_currency_code: {
              type: 'string',
            },
          },
        },

        t_person_identification: {
          type: 'object',
          properties: {
            number: {
              type: 'string',
            },
          },
        },
        report_party_type: {
          type: 'object',
          oneOf: [
            {
              title: 'person',
              type: {
                $ref: '#/definitions/t_person',
              },
            },
            {
              title: 'account',
              type: {
                $ref: '#/definitions/t_account',
              },
            },
            {
              title: 'entity',
              type: {
                $ref: '#/definitions/t_entity',
              },
            },
          ],
          properties: {
            reason: {
              type: 'string',
            },
          },
        },
        transaction: {
          type: 'object',
          properties: {
            transaction_number: {
              type: 'number',
            },
          },
          oneOf: [
            {
              title: 'Involved Parties',
              $ref: '#/definitions/t_party',
            },
            {
              title: 'Bi Party Transaction',
              type: 'object',
              properties: {
                to: {
                  type: 'object',
                  oneOf: [
                    {
                      type: 'object',
                      title: 't_to_my_client',
                      $ref: '#/definitions/t_to_my_client',
                    },
                    {
                      type: 'object',
                      title: 't_to',
                      $ref: '#/definitions/t_to',
                    },
                  ],
                },
                from: {
                  type: 'object',
                  oneOf: [
                    {
                      type: 'object',
                      title: 't_from_my_client',
                      $ref: '#/definitions/t_from_my_client',
                    },
                    {
                      type: 'object',
                      title: 't_from',
                      $ref: '#/definitions/t_from',
                    },
                  ],
                },
              },
            },
          ],
        },
        t_party: {
          type: 'object',
          properties: {
            role: {
              type: 'string',
            },
          },
          oneOf: [
            {
              title: 'person',
              type: {
                $ref: '#/definitions/t_person',
              },
            },
            {
              title: 'person_my_client',
              type: {
                $ref: '#/definitions/t_person_my_client',
              },
            },
          ],
        },
      },
      properties: {
        reentity_id: {
          type: 'string',
        },
        reporting_person: {
          $ref: '#/definitions/t_person_registration_in_report',
        },
        Location: {
          $ref: '#/definitions/t_address',
        },
      },
      oneOf: [
        {
          title: 'transaction',
          type: 'array',
          items: {
            $ref: '#/definitions/transaction',
          },
        },
        {
          title: 'activity',
          type: 'string',
        },
      ],
    }
  }

  public prepopulate(_c: Case, _reporter: Account): KenyaSarData {
    // TODO: Implement me
    return {} as any
  }

  public generate(data: KenyaSarData): string {
    const builder = new xml2js.Builder()
    return builder.buildObject(data)
  }
}

export const KenyaSarReportSchema: ReportSchema = {
  id: 'KE-SAR',
  type: 'SAR',
  country: 'KE',
  schema: KenyaSARReportGenerator.getSchema(),
}
