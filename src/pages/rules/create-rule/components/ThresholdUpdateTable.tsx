import React, { useState } from 'react';
import type { ProColumns } from '@ant-design/pro-table';
import { EditableProTable } from '@ant-design/pro-table';
import { Button } from 'antd';
import { ThresholdUpdateDataSourceType, ThresholdDataType } from '../data';

const getProcessedThresholdData = (
  thresholdData: ThresholdDataType[],
): ThresholdUpdateDataSourceType[] => {
  console.log('Threshold DATA');
  console.log(thresholdData);
  return thresholdData.map((threshold, index) => {
    return {
      id: (Date.now() + index).toString(),
      parameter: threshold.parameter,
      defaultValue: threshold.defaultValue,
    };
  });
};

export const ThresholdUpdateTable: React.FC<{ thresholdData: ThresholdDataType[] }> = ({
  thresholdData,
}) => {
  const processedData = getProcessedThresholdData(thresholdData);
  const [editableKeys, setEditableRowKeys] = useState<React.Key[]>(() =>
    processedData.map((item) => item.id),
  );
  const [dataSource, setDataSource] = useState<ThresholdUpdateDataSourceType[]>(
    () => processedData,
  );

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
