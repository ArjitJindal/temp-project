import { JSONSchemaType } from 'ajv';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';
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
        message.success('Checklist template status updated successfully');
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
  const [itemsCount, setItemsCount] = useState({ p1: 0, p2: 0 });
  const handleEntityChange = useCallback((entity: ChecklistTemplate) => {
    const p1ItemsCount = entity?.categories
      ?.flatMap((c) => c.checklistItems)
      .filter((c) => c.level === 'P1').length;
    const p2ItemsCount = entity?.categories
      ?.flatMap((c) => c.checklistItems)
      .filter((c) => c.level === 'P2').length;
    setItemsCount({ p1: p1ItemsCount, p2: p2ItemsCount });
  }, []);
  const qaPassCriteriaSchema: JSONSchemaType<Pick<ChecklistTemplate, 'qaPassCriteria'>> = useMemo(
    () => ({
      type: 'object',
      properties: {
        qaPassCriteria: {
          title: 'QA pass criteria',
          description: 'Define minimum number of P1 & P2 errors allowed to pass QA',
          type: 'object',
          properties: {
            p1Errors: {
              type: 'integer',
              title: 'P1 errors allowed',
              description: 'If the P1 errors will exceed the allowed limit, QA will fail',
              minimum: 0,
              maximum: itemsCount.p1 ?? 0,
            },
            p2Errors: {
              type: 'integer',
              title: 'P2 errors allowed',
              description: 'If the P2 errors will exceed the allowed limit, QA will fail',
              minimum: 0,
              maximum: itemsCount.p2 ?? 0,
            },
          },
          required: ['p1Errors', 'p2Errors'],
        },
      },
      required: ['qaPassCriteria'],
    }),
    [itemsCount.p1, itemsCount.p2],
  );

  return (
    <SettingsCard
      title="Investigation checklist"
      description="Define investigation checklist for analysts to refer while investigation an alert"
      minRequiredResources={['read:::settings/case-management/checklist-templates/*']}
    >
      <CrudEntitiesTable<DefaultApiGetChecklistTemplatesRequest, ChecklistTemplate>
        tableId="checklist-templates"
        entityName="template"
        entityIdField="id"
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
        onChange={handleEntityChange}
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
                      testName="status-button"
                      size="SMALL"
                      type="TETRIARY"
                      isDisabled={isActive}
                      onClick={onClick}
                      requiredResources={['write:::settings/case-management/*']}
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
        enableClone={true}
      />
    </SettingsCard>
  );
}
