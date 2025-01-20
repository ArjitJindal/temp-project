import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { memoize } from 'lodash'
import { Nango } from '@nangohq/node'
import axios from 'axios'
import { CrmRepository } from '../crm/repository'
import { NangoRepository, CrmRecordParams } from './repository'
import { getSecret } from '@/utils/secrets-manager'
import { NangoWebhookEvent } from '@/@types/openapi-internal/NangoWebhookEvent'
import { NangoModels, NangoRecord } from '@/@types/nango'
import { logger } from '@/core/logger'
import { traceable } from '@/core/xray'
import { CrmGetResponse } from '@/@types/openapi-internal/CrmGetResponse'

type NangoModelData = {
  idKey: string
  timestampKey: string
}

export const NANGO_MODELS_DATA: Record<NangoModels, NangoModelData> = {
  FreshDeskTicket: { idKey: 'id', timestampKey: 'created_at' },
}

// Source: https://docs.nango.dev/reference/api/connection/post
type CRMCredentials = {
  connection_config: { [key: string]: string }
  username: string
}

@traceable
export class NangoService {
  private readonly dynamoDb: DynamoDBDocumentClient

  constructor(dynamoDb: DynamoDBDocumentClient) {
    this.dynamoDb = dynamoDb
  }

  private nango = memoize(async () => {
    const secret = await this.nangoSecret()
    return new Nango({
      secretKey: secret,
    })
  })

  private nangoSecret = memoize(async () => {
    const secret = await getSecret<{ apiKey: string }>('nango')
    return secret.apiKey
  })

  public async getConnectionMetadata(webhook: NangoWebhookEvent) {
    const { connectionId, providerConfigKey } = webhook
    const nango = await this.nango()

    if (!providerConfigKey || !connectionId) {
      throw new Error(`Invalid webhook: ${JSON.stringify(webhook)}`)
    }

    const connection = await nango.getConnection(
      providerConfigKey,
      connectionId
    )

    if (!connection) {
      throw new Error('Connection not found')
    }

    const tenantId = connection.metadata?.tenantId as string | undefined
    const region = connection.metadata?.region as string | undefined

    if (!tenantId || !region) {
      throw new Error('Tenant ID or region not found')
    }

    return { tenantId, region }
  }

  public async recieveWebhook(
    tenantId: string,
    webhook: NangoWebhookEvent,
    _region: string
  ) {
    const { connectionId, providerConfigKey, model, modifiedAfter } = webhook
    const nango = await this.nango()

    if (!providerConfigKey || !connectionId) {
      throw new Error(`Invalid webhook: ${JSON.stringify(webhook)}`)
    }

    const repository = new NangoRepository(tenantId, this.dynamoDb)

    if (!model) {
      throw new Error(
        `No model provided in webhook: ${JSON.stringify(webhook)}`
      )
    }

    const modelData = NANGO_MODELS_DATA[model]

    if (!modelData) {
      throw new Error(`Invalid model: ${model}`)
    }

    let nextCursor: string | null = null

    do {
      const records = await nango.listRecords({
        connectionId,
        providerConfigKey,
        model,
        modifiedAfter,
        ...(nextCursor ? { fromCursorKey: nextCursor } : {}),
      })

      const data = records.records

      logger.info(`Received ${data.length} records`, { records })

      const nangoRecords: NangoRecord[] = data.map((record) => ({
        id: record[NANGO_MODELS_DATA[model].idKey],
        timestamp: record[NANGO_MODELS_DATA[model].timestampKey],
        data: record,
        model: model as NangoModels,
      }))

      await repository.storeRecord(nangoRecords)

      nextCursor = records.next_cursor
    } while (nextCursor)
  }

  public async addCredentials(
    tenantId: string,
    connectionId: string,
    providerConfigKey: string,
    credentials: CRMCredentials
  ) {
    const nangoSecret = await this.nangoSecret()

    try {
      await axios.post(
        `https://api.nango.dev/connection`,
        {
          ...credentials,
          metadata: { tenantId, region: process.env.REGION || 'eu-1' },
          connection_id: connectionId,
          provider_config_key: providerConfigKey,
        },
        {
          headers: {
            Authorization: `Bearer ${nangoSecret}`,
            'Content-Type': 'application/json',
          },
        }
      )
    } catch (error) {
      logger.error('Failed to add credentials with message', {
        message: (error as Error).message,
      })
      throw error
    }
  }

  public async deleteCredentials(
    tenantId: string,
    providerConfigKeys: string[]
  ) {
    const nango = await this.nango()
    const crmRepository = new CrmRepository(tenantId, this.dynamoDb)

    const integrations = await crmRepository.getIntegrations()

    for (const providerConfigKey of providerConfigKeys) {
      const connectionId = integrations[providerConfigKey].connectionId
      await nango.deleteConnection(providerConfigKey, connectionId)
      delete integrations[providerConfigKey]
    }

    await crmRepository.storeIntegrations(integrations)
  }

  public async getCrmNangoRecords(
    tenantId: string,
    crmRecordParams: CrmRecordParams
  ): Promise<CrmGetResponse> {
    const repository = new NangoRepository(tenantId, this.dynamoDb)

    return repository.getCrmRecords(crmRecordParams)
  }
}
