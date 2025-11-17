import React, { useMemo, useRef, useState } from 'react';
import s from './style.module.less';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import { CommonParams, TableColumn, TableRefType } from '@/components/library/Table/types';
import { RuleMLModel } from '@/apis';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { ID, STRING } from '@/components/library/Table/standardDataTypes';
import AiForensicsLogo from '@/components/ui/AiForensicsLogo';
import Tag from '@/components/library/Tag';
import Tooltip from '@/components/library/Tooltip';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import Toggle from '@/components/library/Toggle';
import { useHasMinimumPermission } from '@/utils/user-utils';
import { usePaginatedRuleMlModels, useUpdateRuleMlModel } from '@/utils/api/rules';

interface TableSearchParams extends CommonParams {
  modelId?: string;
  modelType?: string;
  modelName?: string;
}

export const MlModelsPage = () => {
  const [params, setParams] = useState<TableSearchParams>({
    ...DEFAULT_PARAMS_STATE,
  });

  const queryResult = usePaginatedRuleMlModels(params);
  const updateModelMutation = useUpdateRuleMlModel(() => queryResult.refetch());

  const hasWriteAccess = useHasMinimumPermission(['write:::rules/ai-models/*']);

  const columns: TableColumn<RuleMLModel>[] = useMemo((): TableColumn<RuleMLModel>[] => {
    const helper = new ColumnHelper<RuleMLModel>();

    return helper.list([
      helper.simple<'id'>({
        key: 'id',
        title: 'Model ID',
        type: ID,
        defaultWidth: 100,
      }),
      helper.simple<'name'>({
        key: 'name',
        title: 'Model name',
        type: STRING,
        defaultWidth: 200,
      }),
      helper.simple<'description'>({
        key: 'description',
        title: 'Model description',
        type: STRING,
        defaultWidth: 350,
      }),
      helper.simple<'modelType'>({
        key: 'modelType',
        title: 'Model type',
        type: {
          render: (modelType) => {
            if (modelType === 'EXPLAINABLE') {
              return (
                <Tag color="blue">
                  <Tooltip title="Explainable model will show alert explainability reasons after hit.">
                    <div className={s.tag}>
                      <AiForensicsLogo size={'SMALL'} /> Explainable model
                    </div>
                  </Tooltip>
                </Tag>
              );
            }
            return <>Non-explainable</>;
          },
        },
      }),
      helper.simple<'checksFor'>({
        key: 'checksFor',
        title: 'Checks for',
        type: {
          render: (checksFor) => {
            return (
              <div className={s.checksFor}>
                {checksFor?.map((check, index) => {
                  return (
                    <Tag color="action" key={index}>
                      {check}
                    </Tag>
                  );
                })}
              </div>
            );
          },
        },
      }),
      helper.simple<'enabled'>({
        key: 'enabled',
        title: 'Enabled',
        type: {
          render: (enabled, { item }) => {
            return (
              <Toggle
                value={enabled}
                isDisabled={!hasWriteAccess}
                onChange={(checked) => {
                  updateModelMutation.mutate({
                    ...item,
                    enabled: checked,
                  });
                }}
              />
            );
          },
        },
      }),
    ]);
  }, [updateModelMutation, hasWriteAccess]);

  const actionRef = useRef<TableRefType>(null);
  return (
    <QueryResultsTable<RuleMLModel, TableSearchParams>
      tableId="ml-models-table"
      innerRef={actionRef}
      columns={columns}
      queryResults={queryResult}
      pagination={false}
      rowKey="id"
      params={params}
      onChangeParams={(params) => {
        setParams(params);
      }}
      extraFilters={[
        {
          title: 'Model ID',
          key: 'modelId',
          renderer: {
            kind: 'string',
          },
          showFilterByDefault: true,
        },
        {
          title: 'Model name',
          key: 'modelName',
          renderer: {
            kind: 'string',
          },
          showFilterByDefault: true,
        },
        {
          title: 'Model type',
          key: 'modelType',
          renderer: {
            kind: 'select',
            options: [
              {
                value: 'EXPLAINABLE',
                label: 'Explainable',
              },
              {
                value: 'NON_EXPLAINABLE',
                label: 'Non-explainable',
              },
            ],
            mode: 'SINGLE',
            displayMode: 'select',
          },
          showFilterByDefault: true,
        },
      ]}
    />
  );
};
