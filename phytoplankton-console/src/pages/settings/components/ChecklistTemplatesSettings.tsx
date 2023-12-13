import { JSONSchemaType } from 'ajv';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import SettingsCard from '@/components/library/SettingsCard';
import { useApi } from '@/api';
import { ChecklistTemplate, Priority } from '@/apis';
import { DefaultApiGetChecklistTemplatesRequest } from '@/apis/types/ObjectParamAPI';
import { CrudEntitiesTable } from '@/components/library/CrudEntitiesTable';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { LONG_TEXT, STRING } from '@/components/library/Table/standardDataTypes';
import { PRIORITYS } from '@/apis/models-custom/Priority';
import Confirm from '@/components/utils/Confirm';
import { message } from '@/components/library/Message';
import Button from '@/components/library/Button';
import { CHECKLIST_TEMPLATES } from '@/utils/queries/keys';

export function ChecklistTemplatesSettings() {
  const api = useApi();
  const queryClient = useQueryClient();
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

  const qaPassCriteriaSchema: JSONSchemaType<Pick<ChecklistTemplate, 'qaPassCriteria'>> = {
    type: 'object',
    properties: {
      qaPassCriteria: {
        title: 'QA pass criteria',
        description: 'Define minimum number of P1 & P2 errors allowed to pass QA',
        type: 'object',
        properties: {
          p1Errors: {
            type: 'number',
            title: 'P1 errors allowed',
            nullable: true,
          },
          p2Errors: {
            type: 'number',
            title: 'P2 errors allowed',
            nullable: true,
          },
        },
        nullable: true,
      },
    },
  };

  const statusMutation = useMutation(
    async (entity: ChecklistTemplate) => {
      return (
        entity.id !== undefined &&
        (await api.putChecklistTemplates({
          checklistTemplateId: entity.id,
          ChecklistTemplate: entity,
        }))
      );
    },
    {
      onSuccess: () => {
        message.success('Successfully updated status');
      },
      onError: (error: Error) => {
        message.error(`Error: ${error.message}`);
      },
    },
  );

  const getErrorCount = useCallback((level: Priority, entity: ChecklistTemplate) => {
    return entity.categories.reduce(
      (acc, category) =>
        acc +
        category.checklistItems.filter((checklistItem) => checklistItem.level === level).length,
      0,
    );
  }, []);

  const checkErrorCount = useCallback(
    (level: Priority, entity: ChecklistTemplate) => {
      const qaPassCriteria = entity.qaPassCriteria?.[level === 'P1' ? 'p1Errors' : 'p2Errors'];
      if (qaPassCriteria) {
        if (getErrorCount(level, entity) < qaPassCriteria) {
          message.error(`${level} errors allowed cannot be greater than ${level} errors`);
          return false;
        }
      }
      return true;
    },
    [getErrorCount],
  );

  const verifyChecklistTemplatePassCriteria = useCallback(
    (entity: ChecklistTemplate) => {
      const checkP1 = checkErrorCount('P1', entity);
      const checkP2 = checkErrorCount('P2', entity);

      return checkP1 && checkP2;
    },
    [checkErrorCount],
  );

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
          CREATE: async (entity) => {
            if (!verifyChecklistTemplatePassCriteria(entity)) {
              return Promise.reject();
            }
            const data = await api.postChecklistTemplates({ ChecklistTemplate: entity });
            queryClient.invalidateQueries({
              predicate: (query) => query.queryKey[0] === CHECKLIST_TEMPLATES()[0],
            });
            return data;
          },
          UPDATE: (entityId, entity) => {
            if (!verifyChecklistTemplatePassCriteria(entity)) {
              return Promise.reject();
            }
            return api.putChecklistTemplates({
              checklistTemplateId: entityId,
              ChecklistTemplate: entity,
            });
          },
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
          tableHelper.display({
            title: 'Status',
            render: (checklistTemplate) => {
              const isActive = checklistTemplate.status === 'ACTIVE';
              return (
                <Confirm
                  onConfirm={() => {
                    if (!isActive) {
                      checklistTemplate.status = 'ACTIVE';
                      statusMutation.mutate(checklistTemplate);
                    }
                  }}
                  title={`Are you sure you want to change the status to ${
                    isActive ? 'Draft' : 'Active'
                  } `}
                  text="Please confirm that you want to change the status of this template. This action cannot be undone."
                >
                  {({ onClick }) => (
                    <Button
                      size="SMALL"
                      type="TETRIARY"
                      isDisabled={isActive}
                      onClick={onClick}
                      requiredPermissions={['settings:organisation:write']}
                    >
                      {isActive ? 'Active' : 'Draft'}
                    </Button>
                  )}
                </Confirm>
              );
            },
            defaultWidth: 100,
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
          {
            step: {
              key: 'qa-pass-criteria',
              title: 'QA pass criteria',
              description: 'Define QA pass criteria',
            },
            jsonSchema: qaPassCriteriaSchema,
          },
        ]}
      />
    </SettingsCard>
  );
}
