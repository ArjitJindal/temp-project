import { Space } from 'antd';
import { useCallback, useRef, useState } from 'react';
import { JSONSchemaType } from 'ajv';
import { humanizeConstant } from '@flagright/lib/utils/humanize';
import SettingsCard from '@/components/library/SettingsCard';
import { WebhookConfiguration, WebhookEventType } from '@/apis';
import { useApi } from '@/api';
import { TableColumn, TableRefType } from '@/components/library/Table/types';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { message } from '@/components/library/Message';
import { useHasPermissions } from '@/utils/user-utils';
import { CrudEntitiesTable } from '@/components/library/CrudEntitiesTable';
import { DefaultApiGetWebhooksRequest } from '@/apis/types/ObjectParamAPI';
import { WEBHOOK_EVENT_TYPES } from '@/apis/models-custom/WebhookEventType';
import { getBranding } from '@/utils/branding';
import Tag from '@/components/library/Tag';
import Toggle from '@/components/library/Toggle';

export const WebhookConfigurations: React.FC = () => {
  const api = useApi();
  const [updatedWebhooks, setUpdatedWebhooks] = useState<{ [key: string]: WebhookConfiguration }>(
    {},
  );
  const actionRef = useRef<TableRefType>(null);
  const branding = getBranding();
  const handleSaveWebhook = useCallback(
    async (newWebhook: WebhookConfiguration) => {
      const hideMessage = message.loading('Saving...');
      try {
        const webhookId = newWebhook._id;
        if (webhookId) {
          setUpdatedWebhooks((prev) => ({ ...prev, [webhookId]: newWebhook }));
          await api.postWebhooksWebhookid({ webhookId, WebhookConfiguration: newWebhook });
        } else {
          await api.postWebhooks({
            WebhookConfiguration: newWebhook,
          });
          actionRef.current?.reload();
        }
        message.success('Saved');
      } catch (e) {
        message.fatal(`Failed to save`, e);
      } finally {
        hideMessage();
      }
    },
    [api],
  );

  const isDevelopersWriteEnabled = useHasPermissions(['settings:developers:write']);

  const helper = new ColumnHelper<WebhookConfiguration>();
  const columns: TableColumn<WebhookConfiguration>[] = helper.list([
    helper.derived<WebhookConfiguration>({
      title: 'Endpoint URL',
      defaultWidth: 500,
      value: (entity): WebhookConfiguration | undefined => {
        return entity._id ? updatedWebhooks[entity._id] ?? entity : undefined;
      },
      type: {
        render: (webhook: WebhookConfiguration | undefined) => {
          return <>{webhook?.webhookUrl}</>;
        },
      },
    }),
    helper.derived<WebhookConfiguration>({
      title: 'Events',
      value: (entity): WebhookConfiguration | undefined => {
        return entity._id ? updatedWebhooks[entity._id] ?? entity : undefined;
      },
      type: {
        render: (webhook) => {
          return (
            <>
              {webhook?.events.map((event: WebhookEventType, index) => (
                <Tag color={'cyan'} key={index}>
                  {humanizeConstant(event)}
                </Tag>
              ))}
            </>
          );
        },
        stringify: (row) => row?.events.join(', ') ?? '',
      },
    }),
    helper.derived<WebhookConfiguration>({
      title: 'Activated',
      value: (entity): WebhookConfiguration | undefined => {
        return entity._id ? updatedWebhooks[entity._id] ?? entity : undefined;
      },
      defaultWidth: 500,
      type: {
        render: (webhook) => {
          return (
            <Space style={{ alignItems: 'baseline' }}>
              <Toggle
                isDisabled={!isDevelopersWriteEnabled}
                value={webhook?.enabled ?? false}
                onChange={(checked) => {
                  if (webhook) {
                    handleSaveWebhook({ ...webhook, enabled: checked ?? false });
                  }
                }}
              />
              {!webhook?.enabled && webhook?.autoDisableMessage && (
                <span>
                  <i>{webhook?.autoDisableMessage}</i>
                </span>
              )}
            </Space>
          );
        },
        stringify: (row) => (row?.enabled ? 'Yes' : 'No'),
      },
    }),
  ]);

  const templateDetailsSchema: JSONSchemaType<Pick<WebhookConfiguration, 'webhookUrl' | 'events'>> =
    {
      type: 'object',
      properties: {
        webhookUrl: {
          type: 'string',
          title: 'Endpoint URL',
          format: 'uri',
          pattern: '^https?://',
        },
        events: {
          type: 'array',
          title: 'Events',
          items: {
            type: 'string',
            enum: WEBHOOK_EVENT_TYPES,
            enumNames: WEBHOOK_EVENT_TYPES.map((event) => humanizeConstant(event)),
          },
        },
        _id: {
          title: 'Additional properties',
          'ui:schema': {
            'ui:subtype': 'WEBHOOK',
          },
        },
      },
      required: ['webhookUrl', 'events'],
    };

  return (
    <SettingsCard title="Webhooks" description="">
      <CrudEntitiesTable<DefaultApiGetWebhooksRequest, WebhookConfiguration>
        tableId="webhooks-table"
        entityName="endpoint"
        entityIdField="_id"
        readPermissions={['settings:developers:read']}
        writePermissions={['settings:developers:write']}
        apiOperations={{
          GET: () => {
            return api.getWebhooks(100).then((value) => {
              return {
                data: value,
                total: value.length,
              };
            });
          },
          CREATE: (entity) => {
            entity.enabled = true;
            return api.postWebhooks({
              WebhookConfiguration: entity,
            });
          },
          UPDATE: (entityId, entity) => {
            entity.enabled = true;
            return api.postWebhooksWebhookid({
              webhookId: entityId,
              WebhookConfiguration: entity,
            });
          },
          DELETE: (entityId) => api.deleteWebhooksWebhookId({ webhookId: entityId }),
        }}
        columns={columns}
        formWidth="840px"
        formSteps={[
          {
            step: {
              key: 'template-details',
              title: 'Template details',
              description: 'Name the template and add description',
            },
            jsonSchema: templateDetailsSchema,
          },
        ]}
        extraInfo={
          branding.apiDocsLinks.webhooks
            ? {
                label: 'Learn more about webhooks',
                redirectUrl: branding.apiDocsLinks.webhooks,
              }
            : undefined
        }
        portal={true}
      />
    </SettingsCard>
  );
};
