import React, { useState } from 'react';
import type { ProColumns } from '@ant-design/pro-table';
import { EditableProTable } from '@ant-design/pro-table';
import { Button } from 'antd';

type DataSourceType = {
  id: React.Key;
  title?: string;
  decs?: string;
  state?: string;
  created_at?: string;
  children?: DataSourceType[];
};

const defaultData: DataSourceType[] = new Array(5).fill(1).map((_, index) => {
  return {
    id: (Date.now() + index).toString(),
    title: `Parameter ${index}`,
    decs: '这个活动真好玩',
    state: 'open',
    created_at: '2020-05-26T09:42:56Z',
  };
});

export const ThresholdUpdateTable: React.FC = () => {
  const [editableKeys, setEditableRowKeys] = useState<React.Key[]>(() =>
    defaultData.map((item) => item.id),
  );
  const [dataSource, setDataSource] = useState<DataSourceType[]>(() => defaultData);

  const columns: ProColumns<DataSourceType>[] = [
    {
      title: 'Parameter',
      dataIndex: 'title',
      width: '30%',
      editable: false,
      formItemProps: {
        rules: [
          {
            required: true,
            whitespace: true,
            message: '此项是必填项',
          },
          {
            max: 16,
            whitespace: true,
            message: '最长为 16 位',
          },
          {
            min: 6,
            whitespace: true,
            message: '最小为 6 位',
          },
        ],
      },
    },
    {
      title: 'Value',
      key: 'state',
      dataIndex: 'state',
      valueType: 'select',
      valueEnum: {
        all: { text: 'All', status: 'Default' },
        open: {
          text: 'Error',
          status: 'Error',
        },
        closed: {
          text: 'Success',
          status: 'Success',
        },
      },
    },
  ];

  return (
    <>
      <EditableProTable<DataSourceType>
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
