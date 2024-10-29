import { JSONSchemaType } from 'ajv';
import SettingsCard from '@/components/library/SettingsCard';
import { useApi } from '@/api';
import { NarrativeTemplate } from '@/apis';
import { DefaultApiGetNarrativesRequest } from '@/apis/types/ObjectParamAPI';
import { CrudEntitiesTable } from '@/components/library/CrudEntitiesTable';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { LONG_TEXT, STRING } from '@/components/library/Table/standardDataTypes';

export function NarrativeTemplatesSettings() {
  const api = useApi();
  const tableHelper = new ColumnHelper<NarrativeTemplate>();
  const templateDetailsSchema: JSONSchemaType<Pick<NarrativeTemplate, 'name' | 'description'>> = {
    type: 'object',
    properties: {
      name: { type: 'string', title: 'Name' },
      description: {
        type: 'string',
        title: 'Description',
        'ui:schema': { 'ui:subtype': 'MARKDOWN' },
        hideCopilotWidget: true,
      },
    },
    required: ['name', 'description'],
  };

  return (
    <SettingsCard
      title="Narrative templates"
      description="Define your own narrative templates to use in your case management."
    >
      <CrudEntitiesTable<DefaultApiGetNarrativesRequest, NarrativeTemplate>
        tableId="narrative-templates-table"
        entityName="narrative template"
        entityIdField="id"
        readPermissions={['settings:case-management:read']}
        writePermissions={['settings:case-management:write']}
        apiOperations={{
          GET: (params) => {
            return api.getNarratives(params).then((value) => {
              return { data: value.items, total: value.total };
            });
          },
          CREATE: (entity) => {
            return api.postNarrativeTemplate({
              NarrativeTemplateRequest: {
                name: entity.name,
                description: entity.description,
              },
            });
          },
          UPDATE: (entityId, entity) => {
            return api.putNarrativeTemplate({
              narrativeTemplateId: entityId,
              NarrativeTemplateRequest: {
                name: entity.name,
                description: entity.description,
              },
            });
          },
          DELETE: (entityId) => api.deleteNarrativeTemplate({ narrativeTemplateId: entityId }),
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
              key: 'template-details',
              title: 'Template details',
              description: 'Name the template and add description',
            },
            jsonSchema: templateDetailsSchema,
          },
        ]}
      />
    </SettingsCard>
  );
}
