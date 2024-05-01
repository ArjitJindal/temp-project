import React, { useEffect } from 'react';
import cn from 'clsx';
import { Button } from 'antd';
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
import { AsyncResource, getOr, isLoading, map, success } from '@/utils/asyncResource';
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
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import Tag, { TagColor } from '@/components/library/Tag';
import { humanizeConstant } from '@/utils/humanize';
import { RiskScoreValueLevel, RiskScoreValueScore } from '@/apis';

const DEFAULT_PARAMETER_SETTINGS: ParameterSettings = {
  isActive: false,
  weight: 1,
  values: [],
  defaultValue: {
    type: 'RISK_LEVEL',
    value: DEFAULT_RISK_LEVEL,
  },
};

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
    defaultRiskLevel: RiskScoreValueLevel | RiskScoreValueScore,
    weight: number,
  ) => void;
  onActivate: (entityType: Entity, parameter: ParameterName, isActive: boolean) => void;
  canEditParameters?: boolean;
  disablePaddings?: boolean;
}

export default function ParametersTable(props: Props) {
  const {
    parameters,
    parameterSettings,
    onRefresh,
    onSaveValues,
    onActivate,
    disablePaddings = false,
    canEditParameters = true,
  } = props;
  const canEdit = useHasPermissions(['risk-scoring:risk-levels:write']) && canEditParameters;
  const settings = useSettings();
  useEffect(() => {
    for (const parameter of parameters) {
      onRefresh(parameter.parameter, parameter.entity);
    }
  }, [onRefresh, parameters]);

  const columnHelper = new ColumnHelper<RiskLevelTableItem>();
  // todo: i18n
  return (
    <div className={cn(style.root, disablePaddings && style.zeroPadding)}>
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
                const tagText = humanizeConstant(type);
                let color: TagColor | undefined;
                switch (type) {
                  case 'LITERAL':
                    color = 'green';
                    break;
                  case 'RANGE':
                    color = 'blue';
                    break;
                  case 'MULTIPLE':
                    color = 'cyan';
                    break;
                  case 'TIME_RANGE':
                    color = 'purple';
                    break;
                  case 'DAY_RANGE':
                    color = 'purple';
                    break;
                  case 'AMOUNT_RANGE':
                    color = 'purple';
                    break;
                  default:
                    color = neverReturn(type, undefined);
                }

                return <Tag color={color}>{tagText}</Tag>;
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
                success<ParameterSettings>(DEFAULT_PARAMETER_SETTINGS);
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
          columnHelper.display({
            title: 'Weight',
            render: (item) => {
              const parameterRes =
                (parameterSettings && parameterSettings[item.parameter]) ??
                success<ParameterSettings>(DEFAULT_PARAMETER_SETTINGS);
              const weightRes = map(parameterRes, (x) => x.weight);
              const weight = getOr(weightRes, 1);
              return weight;
            },
          }),
          columnHelper.display({
            title: 'Actions',
            render: (item) => {
              const parameterRes =
                (parameterSettings && parameterSettings[item.parameter]) ??
                success<ParameterSettings>(DEFAULT_PARAMETER_SETTINGS);
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
            canEditParameters={canEditParameters}
            item={item}
            currentValuesRes={map(
              (parameterSettings && parameterSettings[item.parameter]) ??
                success<ParameterSettings>(DEFAULT_PARAMETER_SETTINGS),
              (x) => {
                return x.values;
              },
            )}
            onSave={onSaveValues}
            currentWeight={
              map(
                (parameterSettings && parameterSettings[item.parameter]) ??
                  success<ParameterSettings>(DEFAULT_PARAMETER_SETTINGS),
                (x) => {
                  return x.weight;
                },
              ) ?? 1
            }
            currentDefaultValue={
              map(
                (parameterSettings && parameterSettings[item.parameter]) ??
                  success<ParameterSettings>(DEFAULT_PARAMETER_SETTINGS),
                (x) => {
                  return x.defaultValue;
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
