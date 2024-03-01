import React, { useEffect } from 'react';
import { Button, Tag } from 'antd';
import {
  Entity,
  ParameterName,
  ParameterSettings,
  ParameterValues,
  RiskLevelTable,
  RiskLevelTableItem,
} from './types';
import style from './style.module.less';
import ValuesTable from './ValuesTable';
import { AsyncResource, getOr, init, isLoading, map } from '@/utils/asyncResource';
import { neverReturn } from '@/utils/lang';
import ActivityIndicator from '@/pages/risk-levels/risk-factors/ParametersTable/ActivityIndicator';
import Table from '@/components/library/Table';
import {
  DATA_TYPE_TO_VALUE_TYPE,
  DEFAULT_RISK_LEVEL,
} from '@/pages/risk-levels/risk-factors/ParametersTable/consts';
import { useHasPermissions } from '@/utils/user-utils';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { LONG_TEXT } from '@/components/library/Table/standardDataTypes';
import { RiskLevel } from '@/utils/risk-levels';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';

interface Props {
  parameters: RiskLevelTable;
  parameterSettings?: {
    [key in ParameterName]?: AsyncResource<ParameterSettings>;
  };
  onRefresh: (parameter: ParameterName, entity: Entity) => void;
  onSaveValues: (
    parameter: ParameterName,
    newValues: ParameterValues,
    entityType: Entity,
    defaultRiskLevel: RiskLevel,
    weight: number,
  ) => void;
  onActivate: (entityType: Entity, parameter: ParameterName, isActive: boolean) => void;
}

export default function ParametersTable(props: Props) {
  const { parameters, parameterSettings, onRefresh, onSaveValues, onActivate } = props;
  const canEdit = useHasPermissions(['risk-scoring:risk-levels:write']);
  const settings = useSettings();
  useEffect(() => {
    for (const parameter of parameters) {
      onRefresh(parameter.parameter, parameter.entity);
    }
  }, [onRefresh, parameters]);

  const columnHelper = new ColumnHelper<RiskLevelTableItem>();
  // todo: i18n
  return (
    <div className={style.root}>
      <Table<RiskLevelTableItem>
        rowKey="parameter"
        columns={columnHelper.list([
          columnHelper.simple({ title: 'Factor name', key: 'title' }),
          columnHelper.simple({
            title: 'Type',
            key: 'dataType',
            type: {
              render: (dataType) => {
                if (dataType == null) {
                  return <Tag>{dataType}</Tag>;
                }
                const type = DATA_TYPE_TO_VALUE_TYPE[dataType];
                switch (type) {
                  case 'LITERAL':
                    return <Tag color="green">{type}</Tag>;
                  case 'RANGE':
                    return <Tag color="blue">{type}</Tag>;
                  case 'MULTIPLE':
                    return <Tag color="cyan">{type}</Tag>;
                  case 'TIME_RANGE':
                    return <Tag color="purple">{type.replace('_', ' ')}</Tag>;
                  case 'DAY_RANGE':
                    return <Tag color="purple">{type.replace('_', ' ')}</Tag>;
                  case 'AMOUNT_RANGE':
                    return <Tag color="purple">{type.replace('_', ' ')}</Tag>;
                }

                return neverReturn(type, <Tag>{type}</Tag>);
              },
            },
          }),
          columnHelper.simple({
            title: 'Factor description',
            key: 'description',
            defaultWidth: 300,
            type: LONG_TEXT,
          }),
          columnHelper.display({
            title: 'Status',
            render: (item) => {
              const parameterRes =
                (parameterSettings && parameterSettings[item.parameter]) ??
                init<ParameterSettings>();
              const isActiveRes = map(parameterRes, (x) => x.isActive);
              const isActive = getOr(isActiveRes, false);
              return (
                <span className={style.status}>
                  <ActivityIndicator isActive={isActive} />
                  {isActive ? 'Active' : 'Inactive'}
                </span>
              );
            },
          }),
          columnHelper.simple({
            title: 'Weight',
            key: 'weight',
            defaultWidth: 100,
          }),
          columnHelper.display({
            title: 'Actions',
            render: (item) => {
              const parameterRes =
                (parameterSettings && parameterSettings[item.parameter]) ??
                init<ParameterSettings>();
              const isActiveRes = map(parameterRes, (x) => x.isActive);
              const isActive = getOr(isActiveRes, false);
              return (
                <Button
                  disabled={isLoading(parameterRes) || !canEdit}
                  size="small"
                  type="ghost"
                  onClick={() => {
                    onActivate(item.entity, item.parameter, !isActive);
                  }}
                >
                  {isActive ? 'Deactivate' : 'Activate'}
                </Button>
              );
            },
          }),
        ])}
        data={{
          items: parameters.filter(
            (x) => !x?.requiredFeatures || x.requiredFeatures.every((f) => settings?.features?.[f]),
          ),
        }}
        renderExpanded={(item) => (
          <ValuesTable
            item={item}
            currentValuesRes={map(
              (parameterSettings && parameterSettings[item.parameter]) ?? init<ParameterSettings>(),
              (x) => {
                return x.values;
              },
            )}
            onSave={onSaveValues}
            currentWeight={
              map(
                (parameterSettings && parameterSettings[item.parameter]) ??
                  init<ParameterSettings>(),
                (x) => {
                  return x.weight;
                },
              ) ?? 1
            }
            currentDefaultRiskLevel={
              map(
                (parameterSettings && parameterSettings[item.parameter]) ??
                  init<ParameterSettings>(),
                (x) => {
                  return x.defaultRiskLevel;
                },
              ) ?? DEFAULT_RISK_LEVEL
            }
          />
        )}
        pagination={false}
        toolsOptions={false}
      />
    </div>
  );
}
