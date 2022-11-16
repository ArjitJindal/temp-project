import React, { useEffect } from 'react';
import { Button, Tag } from 'antd';
import {
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
import ActivityIndicator from '@/pages/risk-levels/risk-level/ParametersTable/ActivityIndicator';
import Table from '@/components/ui/Table';
import { DATA_TYPE_TO_VALUE_TYPE } from '@/pages/risk-levels/risk-level/ParametersTable/consts';

interface Props {
  parameters: RiskLevelTable;
  parameterSettings: {
    [key in ParameterName]?: AsyncResource<ParameterSettings>;
  };
  onRefresh: (parameter: ParameterName) => void;
  onSaveValues: (parameter: ParameterName, newValues: ParameterValues) => void;
  onActivate: (parameter: ParameterName, isActive: boolean) => void;
}

export default function ParametersTable(props: Props) {
  const { parameters, parameterSettings, onRefresh, onSaveValues, onActivate } = props;

  useEffect(() => {
    for (const parameter of parameters) {
      onRefresh(parameter.parameter);
    }
  }, [onRefresh, parameters]);

  // todo: i18n
  return (
    <div className={style.root}>
      <Table<RiskLevelTableItem>
        disableExpandedRowPadding={true}
        disableInternalPadding={true}
        form={{
          labelWrap: true,
        }}
        rowKey="parameter"
        search={false}
        scroll={{ x: 1000 }}
        columns={[
          { title: 'Parameter Name', dataIndex: 'title' },
          {
            title: 'Type',
            dataIndex: 'type',
            render: (_, item) => {
              const type = DATA_TYPE_TO_VALUE_TYPE[item.dataType];
              switch (type) {
                case 'LITERAL':
                  return <Tag color="green">{type}</Tag>;
                case 'RANGE':
                  return <Tag color="blue">{type}</Tag>;
                case 'MULTIPLE':
                  return <Tag color="cyan">{type}</Tag>;
              }
              return neverReturn(type, <Tag>{type}</Tag>);
            },
          },
          { title: 'Parameter Description', dataIndex: 'description' },
          {
            title: 'Status',
            render: (_, item) => {
              const parameterRes = parameterSettings[item.parameter] ?? init<ParameterSettings>();
              const isActiveRes = map(parameterRes, (x) => x.isActive);
              const isActive = getOr(isActiveRes, false);
              return (
                <span className={style.status}>
                  <ActivityIndicator isActive={isActive} />
                  {isActive ? 'Active' : 'Inactive'}
                </span>
              );
            },
          },
          {
            title: 'Actions',
            render: (_, item) => {
              const parameterRes = parameterSettings[item.parameter] ?? init<ParameterSettings>();
              const isActiveRes = map(parameterRes, (x) => x.isActive);
              const isActive = getOr(isActiveRes, false);
              return (
                <Button
                  disabled={isLoading(parameterRes)}
                  size="small"
                  type="ghost"
                  onClick={() => {
                    onActivate(item.parameter, !isActive);
                  }}
                >
                  {isActive ? 'Deactivate' : 'Activate'}
                </Button>
              );
            },
          },
        ]}
        data={{
          items: parameters,
        }}
        expandable={{
          expandedRowRender: (item: RiskLevelTableItem) => (
            <ValuesTable
              item={item}
              currentValuesRes={map(
                parameterSettings[item.parameter] ?? init<ParameterSettings>(),
                (x) => x.values,
              )}
              onSave={onSaveValues}
            />
          ),
        }}
        defaultSize={'small'}
        pagination={false}
        options={{
          density: false,
          setting: false,
          reload: false,
        }}
      />
    </div>
  );
}
