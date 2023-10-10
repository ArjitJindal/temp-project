import { JSONSchemaType } from 'ajv';
import SettingsCard from '@/components/library/SettingsCard';
import { useApi } from '@/api';
import { ChecklistTemplate } from '@/apis';
import { DefaultApiGetChecklistTemplatesRequest } from '@/apis/types/ObjectParamAPI';
import { CrudEntitiesTable } from '@/components/library/CrudEntitiesTable';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { LONG_TEXT, STRING } from '@/components/library/Table/standardDataTypes';
import { PRIORITYS } from '@/apis/models-custom/Priority';

export function ChecklistTemplatesSettings() {
  const api = useApi();
  const tableHelper = new ColumnHelper<ChecklistTemplate>();
  const templateDetailsSchema: JSONSchemaType<Pick<ChecklistTemplate, 'name' | 'description'>> = {
    type: 'object',
    properties: {
      name: { type: 'string', title: 'Name' },
      description: { type: 'string', title: 'Description', nullable: true },
    },
    required: ['name'],
  };
  const categoryDetailsSchema: JSONSchemaType<Pick<ChecklistTemplate, 'categories'>> = {
    type: 'object',
    properties: {
      categories: {
        title: 'Category details',
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', title: 'Name' },
            checklistItems: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', title: 'ID', nullable: true, readOnly: true },
                  name: { type: 'string', title: 'Name' },
                  level: { type: 'string', enum: PRIORITYS, title: 'Priority' },
                },
                required: ['name', 'level'],
              },
            },
          },
          required: ['name', 'checklistItems'],
        },
        'ui:schema': {
          'ui:subtype': 'CHECKLISTS_CATEGORY_LIST',
        },
      },
    },
    required: ['categories'],
  };
  return (
    <SettingsCard
      title="Investigation checklist"
      description="Define investigation checklist for analysts to refer while investigation an alert"
    >
      <CrudEntitiesTable<DefaultApiGetChecklistTemplatesRequest, ChecklistTemplate>
        entityName="template"
        entityIdField="id"
        readPermissions={['settings:organisation:read']}
        writePermissions={['settings:organisation:write']}
        apiOperations={{
          GET: (params) => api.getChecklistTemplates(params),
          CREATE: (entity) => api.postChecklistTemplates({ ChecklistTemplate: entity }),
          UPDATE: (entityId, entity) =>
            api.putChecklistTemplates({
              checklistTemplateId: entityId,
              ChecklistTemplate: entity,
            }),
          DELETE: (entityId) => api.deleteChecklistTemplate({ checklistTemplateId: entityId }),
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
          {
            step: {
              key: 'category-details',
              title: 'Category details',
              description: 'Create categories and add checklist to each category',
            },
            jsonSchema: categoryDetailsSchema,
          },
        ]}
      />
    </SettingsCard>
  );
}
