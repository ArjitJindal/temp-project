import type { ProColumns, ActionType } from '@ant-design/pro-table';
import ProTable from '@ant-design/pro-table';
import { Button, Tag, Modal } from 'antd';
import { Dispatch, SetStateAction, useRef } from 'react';
import {
  StepDataType,
  TableListPagination,
  RiskScoreDataSourceType,
  ParameterTableListItem,
  actionToColor,
  RiskScoringDataType,
} from '../data.d';

import { businessAgeRiskScoreData } from '../data/RawRiskData';

import { riskRarameters } from '../service';

const getProcessedRiskScoringData = (
  riskScoringData: RiskScoringDataType,
): RiskScoreDataSourceType[] => {
  const { rows, columns } = riskScoringData;
  return rows.map((riskScoreRows, index) => {
    return {
      id: riskScoreRows[columns[0]] + index.toString(), //lol
      parameter: riskScoreRows[columns[0]],
      defaultValue: riskScoreRows[columns[1]],
    };
  });
};

const handleAction = (key: string | number) => {
  if (key === 'activate') {
    Modal.confirm({
      title: 'Confirm Deactivation',
      content: 'Confirm rule',
      okText: 'Activate',
      cancelText: 'Cancel',
      onOk: () => console.log('WHAAAA'), // deleteItem(currentItem.id),
    });
  } else if (key === 'deactivate') {
    Modal.confirm({
      title: 'Confirm Deactivation',
      content: 'Confirm rule',
      okText: 'Deactivate',
      cancelText: 'Cancel',
      onOk: () => console.log('WHAAAA'), // deleteItem(currentItem.id),
    });
  }
};

export const RiskScoreParametersTableSearch: React.FC<{
  setStepData: Dispatch<SetStateAction<StepDataType>>;
  setDataSource: Dispatch<SetStateAction<RiskScoreDataSourceType[]>>;
  setEditableRowKeys: Dispatch<SetStateAction<React.Key[]>>;
}> = ({ setStepData, setDataSource, setEditableRowKeys }) => {
  const actionRef = useRef<ActionType>();
  const columns: ProColumns<ParameterTableListItem>[] = [
    {
      title: 'Parameter Name',
      dataIndex: 'name',
      tip: 'Parameter to risk score users on',
      renderText: (dom: string) => `${dom}`,
    },
    {
      title: 'Type',
      dataIndex: 'parameterType',
      key: 'parameterType',
      render: (parameterType) => {
        return (
          <span>
            <Tag color={actionToColor[parameterType as string]}>
              {(parameterType as string).toUpperCase()}
            </Tag>
          </span>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      hideInForm: true,
      sorter: true,
      valueEnum: {
        0: {
          text: 'Not Setup',
          status: 'Default',
        },
        1: {
          text: 'Inactive',
          status: 'Processing',
        },
        2: {
          text: 'Active',
          status: 'Success',
        },
      },
    },
    {
      title: 'Parameter description',
      sorter: true,
      dataIndex: 'parameterDescription',
      renderText: (val: string) => `${val}`,
    },
    {
      title: 'Action',
      width: 140,
      dataIndex: 'status',
      key: 'status',
      fixed: 'right',
      render: (status) => {
        return (
          <span>
            {status == 0 || status == 1 ? (
              <Button
                shape="round"
                size="small"
                style={{ borderColor: '#1890ff', color: '#1890ff' }}
                onClick={() => handleAction('activate')}
              >
                Activate
              </Button>
            ) : (
              <Button shape="round" size="small" danger onClick={() => handleAction('deactivate')}>
                Deactivate
              </Button>
            )}
          </span>
        );
      },
    },
  ];
  return (
    <ProTable<ParameterTableListItem, TableListPagination>
      headerTitle="Select Parameter"
      actionRef={actionRef}
      rowKey="key"
      search={{
        labelWidth: 30,
      }}
      toolBarRender={() => []}
      request={riskRarameters}
      columns={columns}
      rowSelection={{
        onChange: (_, selectedRows) => {
          setStepData({
            name: selectedRows[0].name,
            parameterDescription: selectedRows[0].parameterDescription,
            parameterId: selectedRows[0].parameterId,
            parameterType: selectedRows[0].parameterType,
          });
          setDataSource(getProcessedRiskScoringData(selectedRows[0].parameterRiskScoreValues));
          setEditableRowKeys(() =>
            getProcessedRiskScoringData(selectedRows[0].parameterRiskScoreValues).map(
              (item: any) => item.id,
            ),
          );
        },
        type: 'radio',
      }}
    />
  );
};
