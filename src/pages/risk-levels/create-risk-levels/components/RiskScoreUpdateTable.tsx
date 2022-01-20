import React, { Dispatch, SetStateAction } from 'react';
import type { ProColumns } from '@ant-design/pro-table';
import { EditableProTable } from '@ant-design/pro-table';
import { Button } from 'antd';
import { RiskScoreDataSourceType } from '../data';

export const RiskScoreUpdateTable: React.FC<{
  editableKeys: React.Key[];
  setEditableRowKeys: Dispatch<SetStateAction<React.Key[]>>;
  dataSource: RiskScoreDataSourceType[];
  setDataSource: Dispatch<SetStateAction<RiskScoreDataSourceType[]>>;
}> = ({ editableKeys, setEditableRowKeys, dataSource, setDataSource }) => {
  const columns: ProColumns<RiskScoreDataSourceType>[] = [
    {
      title: 'Parameter',
      dataIndex: 'parameter',
      width: '30%',
      editable: false,
      formItemProps: {
        rules: [
          {
            required: true,
            whitespace: true,
            message: 'Please enter value',
          },
        ],
      },
    },
    {
      title: 'Value',
      key: 'defaultValue',
      dataIndex: 'defaultValue',
    },
  ];

  return (
    <>
      <EditableProTable<RiskScoreDataSourceType>
        headerTitle="Risk scoring table"
        columns={columns}
        rowKey="id"
        value={dataSource}
        onChange={setDataSource}
        toolBarRender={() => {
          return [
            <Button
              type="primary"
              key="save"
              onClick={() => {
                // dataSource - you can call API to save it
                console.log(dataSource);
              }}
            >
              Save Data
            </Button>,
          ];
        }}
        editable={{
          type: 'single',
          editableKeys,
          actionRender: (row, config, defaultDoms) => {
            return [defaultDoms.delete];
          },
          onValuesChange: (record, recordList) => {
            setDataSource(recordList);
          },
          onChange: setEditableRowKeys,
        }}
        recordCreatorProps={false}
      />
    </>
  );
};
