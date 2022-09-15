import React, { useEffect } from 'react';
import { Button, Tag } from 'antd';
import { ParameterName, ParameterSettings, ParameterValues, RiskLevelTableItem } from './types';
import { PARAMETERS } from './consts';
import style from './style.module.less';
import ValuesTable from './ValuesTable';
import { AsyncResource, getOr, init, isLoading, map } from '@/utils/asyncResource';
import { neverReturn } from '@/utils/lang';
import ActivityIndicator from '@/pages/risk-levels/risk-level/ParametersTable/ActivityIndicator';
import Table from '@/components/ui/Table';

interface Props {
  parameterSettings: {
    [key in ParameterName]?: AsyncResource<ParameterSettings>;
  };
  onRefresh: (parameter: ParameterName) => void;
  onSaveValues: (parameter: ParameterName, newValues: ParameterValues) => void;
  onActivate: (parameter: ParameterName, isActive: boolean) => void;
}

export default function ParametersTable(props: Props) {
  const { parameterSettings, onRefresh, onSaveValues, onActivate } = props;

  useEffect(() => {
    for (const parameter of PARAMETERS) {
      onRefresh(parameter.parameter);
    }
  }, [onRefresh]);

  // todo: i18n
  return (
    <Table<RiskLevelTableItem>
      disableExpandedRowPadding={true}
      form={{
        labelWrap: true,
      }}
      headerTitle="Select Parameter"
      rowKey="parameter"
      search={false}
      columns={[
        { title: 'Parameter Name', dataIndex: 'title' },
        {
          title: 'Type',
          dataIndex: 'type',
          render: (_, item) => {
            switch (item.type) {
              case 'ENUMERATION':
                return <Tag color="success">{item.type}</Tag>;
              case 'RANGE':
                return <Tag color="processing">{item.type}</Tag>;
            }
            return neverReturn(item.type, <Tag>{item.type}</Tag>);
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
        items: PARAMETERS,
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
  );
}
