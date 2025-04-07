import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { memoize } from 'lodash'
import { Nango, RecordMetadata } from '@nangohq/node'
import createHttpError from 'http-errors'
import { NangoRepository } from './repository'
import { getSecret } from '@/utils/secrets-manager'
import { NangoWebhookEvent } from '@/@types/openapi-internal/NangoWebhookEvent'
import { NangoModels } from '@/@types/nango'
import { logger } from '@/core/logger'
import { traceable } from '@/core/xray'
import { CrmGetResponse } from '@/@types/openapi-internal/CrmGetResponse'
import { ContextUser, getContext } from '@/core/utils/context'
import { NangoConnection } from '@/@types/openapi-internal/NangoConnection'
import dayjs from '@/utils/dayjs'
import { NangoPostConnectResponse } from '@/@types/openapi-internal/NangoPostConnectResponse'
import { NangoPostConnect } from '@/@types/openapi-internal/NangoPostConnect'
import {
  DefaultApiGetCrmRecordsRequest,
  DefaultApiGetCrmRecordsSearchRequest,
} from '@/@types/openapi-internal/RequestParameters'
import { CRMModelType } from '@/@types/openapi-internal/CRMModelType'
import { CrmName } from '@/@types/openapi-internal/CrmName'
import { CRMRecord } from '@/@types/openapi-internal/CRMRecord'
import { NangoTicket } from '@/@types/openapi-internal/NangoTicket'
import { CRMRecordLinkRequest } from '@/@types/openapi-public-management/CRMRecordLinkRequest'
import { CRMRecordLinkResponse } from '@/@types/openapi-public-management/CRMRecordLinkResponse'
import { CRMRecordSearch } from '@/@types/openapi-internal/CRMRecordSearch'

type NangoModelData = {
  idKey: string
  timestampKey: string
}

const NANGO_MODEL_TYPE_MAP: Record<
  NangoModels,
  { recordType: CRMModelType; crmName: CrmName }
> = {
  FreshdeskTicket: { recordType: 'TICKET', crmName: 'FRESHDESK' },
}

export const NANGO_MODELS_DATA: Record<NangoModels, NangoModelData> = {
  FreshdeskTicket: { idKey: 'id', timestampKey: 'createdAt' },
}

type NangoListRecordsResponse<T> = {
  records: (T & { _nango_metadata: RecordMetadata })[]
  next_cursor: string | null
}

type IncomingRecord = NangoTicket

@traceable
export class NangoService {
  constructor(
    private readonly tenantId: string,
    private readonly dynamoDb: DynamoDBDocumentClient
  ) {
    this.tenantId = tenantId
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

  public async recieveWebhook(webhook: NangoWebhookEvent, _region: string) {
    const { connectionId, providerConfigKey, model, modifiedAfter } = webhook
    const nango = await this.nango()

    if (!providerConfigKey || !connectionId) {
      throw new Error(`Invalid webhook: ${JSON.stringify(webhook)}`)
    }

    const repository = new NangoRepository(this.tenantId, this.dynamoDb)

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
      const records: NangoListRecordsResponse<IncomingRecord> =
        await nango.listRecords<IncomingRecord>({
          connectionId,
          providerConfigKey,
          model,
          modifiedAfter,
          ...(nextCursor ? { fromCursorKey: nextCursor } : {}),
        })

      const data = records.records

      logger.info(`Received ${data.length} records`, { records })
      const { recordType, crmName } = NANGO_MODEL_TYPE_MAP[model as NangoModels]

      const nangoRecords: CRMRecord[] = data.map((record: IncomingRecord) => {
        const { idKey, timestampKey } = NANGO_MODELS_DATA[model]

        const crmRecord: CRMRecord = {
          data: { record: record, recordType },
          timestamp: record[timestampKey],
          id: record[idKey],
          crmName,
          recordType,
        }

        return crmRecord
      })

      await repository.storeRecord(nangoRecords)

      nextCursor = records.next_cursor
    } while (nextCursor)
  }

  public async getCrmNangoRecords(
    crmRecordParams: DefaultApiGetCrmRecordsRequest
  ): Promise<CrmGetResponse> {
    const repository = new NangoRepository(this.tenantId, this.dynamoDb)

    return repository.getCrmRecords(crmRecordParams)
  }

  public async createConnectSession(): Promise<NangoConnection> {
    const nango = await this.nango()
    const listIntegrations = await nango.listIntegrations()
    const tenantName = getContext()?.tenantName as string
    const user = getContext()?.user as ContextUser
    const listConnections = await nango.listConnections(undefined, undefined, {
      endUserOrganizationId: this.tenantId,
    })
    const currentIntegrations = listConnections.connections.map(
      (connection) => connection.provider_config_key
    )
    const integrationsAllowed = listIntegrations.configs.filter(
      (integration) => !currentIntegrations.includes(integration.provider)
    )

    const { data } = await nango.createConnectSession({
      end_user: {
        id: user?.id as string,
        email: user?.email as string,
        display_name: user?.email as string,
      },
      organization: { id: this.tenantId, display_name: tenantName },
      allowed_integrations: integrationsAllowed.map(
        (integration) => integration.provider
      ),
    })

    return {
      token: data.token,
      expiresAt: dayjs(data.expires_at).valueOf(),
      currentIntegrations: listConnections.connections.map((connection) => {
        return {
          providerConfigKey: connection.provider_config_key,
          connectionId: connection.connection_id,
        }
      }),
      allowedIntegrations: integrationsAllowed.map(
        (integration) => integration.provider
      ),
    }
  }

  public async postConnectSession(
    tenantId: string,
    nangoPostConnect: NangoPostConnect
  ): Promise<NangoPostConnectResponse> {
    const nango = await this.nango()

    const { connectionId, providerConfigKey } = nangoPostConnect

    const currentConnections = await nango.listConnections(
      undefined,
      undefined,
      { endUserOrganizationId: tenantId }
    )

    // if already a connection with providerConfigKey, throw an error
    const existingConnection = currentConnections.connections.find(
      (connection) =>
        connection.provider_config_key === providerConfigKey &&
        connection.connection_id !== connectionId
    )

    if (existingConnection) {
      await nango.deleteConnection(providerConfigKey, connectionId)
      throw createHttpError(400, 'Connection already exists')
    }

    await nango.setMetadata(providerConfigKey, connectionId, {
      tenantId,
      region: process.env.REGION || 'eu-1',
    })

    return {
      success: true,
      message: 'Connection successfully created',
    }
  }

  public async deleteConnection(nangoPostConnect: NangoPostConnect) {
    const nango = await this.nango()
    const { connectionId, providerConfigKey } = nangoPostConnect
    await nango.deleteConnection(providerConfigKey, connectionId)
  }

  public async linkCrmRecord(
    linkRequest: CRMRecordLinkRequest
  ): Promise<CRMRecordLinkResponse> {
    const repository = new NangoRepository(this.tenantId, this.dynamoDb)

    // model names valid for each crmName
    const validModels = Object.entries(NANGO_MODEL_TYPE_MAP).map(
      ([_, { crmName, recordType }]) => ({
        recordType,
        crmName,
      })
    )

    const isValidModel = validModels.some(
      (model) => model.recordType === linkRequest.recordType
    )

    if (!isValidModel) {
      const message = `For record type ${
        linkRequest.recordType
      }, the following models are valid: ${validModels
        .filter((model) => model.crmName === linkRequest.crmName)
        .map((model) => model.recordType)
        .join(', ')}`
      throw new Error(message)
    }

    const crmRecord = await repository.getCrmRecordsFromDynamoDb(
      [linkRequest.crmRecordId],
      linkRequest.recordType
    )

    if (crmRecord.length === 0) {
      throw new Error(`CRM record not found: ${linkRequest.crmRecordId}`)
    }

    await repository.linkCrmRecord({
      crmName: linkRequest.crmName,
      recordType: linkRequest.recordType,
      id: linkRequest.crmRecordId,
      userId: linkRequest.userId,
      timestamp: dayjs().valueOf(),
    })

    return {
      success: true,
      message: 'CRM record linked successfully',
    }
  }

  public async getCrmRecordsSearch(
    crmRecordSearch: DefaultApiGetCrmRecordsSearchRequest
  ): Promise<CRMRecordSearch[]> {
    const repository = new NangoRepository(this.tenantId, this.dynamoDb)

    return repository.getCrmRecordsSearch(crmRecordSearch)
  }
}
