import { JSONSchemaType } from 'ajv';
import SettingsCard from '@/components/library/SettingsCard';
import { useApi } from '@/api';
import { CrudEntitiesTable } from '@/components/library/CrudEntitiesTable';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { LONG_TEXT, STRING } from '@/components/library/Table/standardDataTypes';
import { RuleQueue } from '@/apis';
import { DefaultApiGetRuleQueuesRequest } from '@/apis/types/ObjectParamAPI';

export function RuleQueuesSettings() {
  const api = useApi();
  const tableHelper = new ColumnHelper<RuleQueue>();
  const queueDetailsSchema: JSONSchemaType<Pick<RuleQueue, 'name' | 'description'>> = {
    type: 'object',
    properties: {
      name: { type: 'string', title: 'Name' },
      description: { type: 'string', title: 'Description', nullable: true },
    },
    required: ['name'],
  };
  return (
    <SettingsCard
      title="Queue"
      description="Define queues for the alerts. You can select a queue when setting up a rule."
    >
      <CrudEntitiesTable<DefaultApiGetRuleQueuesRequest, RuleQueue>
        tableId="rule-queues-table"
        entityName="queue"
        entityIdField="id"
        readPermissions={['settings:case-management:read']}
        writePermissions={['settings:case-management:write']}
        apiOperations={{
          GET: (params) => api.getRuleQueues(params),
          CREATE: (entity) => api.postRuleQueue({ RuleQueue: entity }),
          UPDATE: (entityId, entity) =>
            api.putRuleQueue({
              ruleQueueId: entityId,
              RuleQueue: entity,
            }),
          DELETE: (entityId) => api.deleteRuleQueue({ ruleQueueId: entityId }),
        }}
        columns={[
          tableHelper.simple({
            title: 'Name',
            key: 'name',
            defaultWidth: 200,
            type: STRING,
          }),
          tableHelper.simple({
            title: 'Description',
            key: 'description',
            defaultWidth: 400,
            type: LONG_TEXT,
          }),
        ]}
        formWidth="800px"
        formSteps={[
          {
            step: {
              key: 'queue-details',
              title: 'Queue details',
              description: 'Name the queue and add description',
            },
            jsonSchema: queueDetailsSchema,
          },
        ]}
      />
    </SettingsCard>
  );
}
