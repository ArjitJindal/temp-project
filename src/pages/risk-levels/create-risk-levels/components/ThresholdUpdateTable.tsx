import React, { Dispatch, SetStateAction } from 'react';
import type { ProColumns } from '@ant-design/pro-table';
import { EditableProTable } from '@ant-design/pro-table';
import { Button } from 'antd';
import { ThresholdUpdateDataSourceType } from '../data.d';

export const ThresholdUpdateTable: React.FC<{
  editableKeys: React.Key[];
  setEditableRowKeys: Dispatch<SetStateAction<React.Key[]>>;
  dataSource: ThresholdUpdateDataSourceType[];
  setDataSource: Dispatch<SetStateAction<ThresholdUpdateDataSourceType[]>>;
}> = ({ editableKeys, setEditableRowKeys, dataSource, setDataSource }) => {
  const columns: ProColumns<ThresholdUpdateDataSourceType>[] = [
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
      <EditableProTable<ThresholdUpdateDataSourceType>
        headerTitle="Threshold update table"
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
