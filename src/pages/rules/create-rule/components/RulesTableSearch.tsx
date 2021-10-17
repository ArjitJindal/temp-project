import type { ProColumns, ActionType } from '@ant-design/pro-table';
import ProTable from '@ant-design/pro-table';
import { Input, Tag } from 'antd';
import { Dispatch, SetStateAction, useRef, useState } from 'react';
import {
  RuleAction,
  StepDataType,
  TableListItem,
  TableListPagination,
  ThresholdDataType,
} from '../data.d';
import { rules } from '../service';

export const RulesTableSearch: React.FC<{
  setStepData: Dispatch<SetStateAction<StepDataType>>;
  setRuleAction: Dispatch<SetStateAction<RuleAction>>;
  setThresholdData: Dispatch<SetStateAction<ThresholdDataType[]>>;
}> = ({ setStepData, setRuleAction, setThresholdData }) => {
  const [currentRow, setCurrentRow] = useState<TableListItem>();
  const [showDetail, setShowDetail] = useState<boolean>(false);

  //type this better lol
  const actionToColor = {
    flag: 'orange',
    block: 'volcano',
    allow: 'green',
  };

  const actionRef = useRef<ActionType>();

  const columns: ProColumns<TableListItem>[] = [
    {
      title: 'Rule name',
      dataIndex: 'name',
      tip: 'RuleName key',
      render: (dom, entity) => {
        return (
          <a
            onClick={() => {
              setCurrentRow(entity);
              setShowDetail(true);
            }}
          >
            {dom}
          </a>
        );
      },
    },
    {
      title: 'Action',
      dataIndex: 'defaultRuleAction',
      key: 'defaultRuleAction',
      render: (defaultRuleAction) => {
        return (
          <span>
            <Tag color={actionToColor[defaultRuleAction as string]}>
              {(defaultRuleAction as string).toUpperCase()}
            </Tag>
          </span>
        );
      },
    },
    {
      title: 'Rule Template ID',
      dataIndex: 'ruleId',
      sorter: true,
      hideInForm: true,
      renderText: (val: string) => `${val}`,
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
      title: 'Rule description',
      sorter: true,
      dataIndex: 'ruleDescription',
      renderFormItem: (item, { defaultRender, ...rest }, form) => {
        const status = form.getFieldValue('status');

        if (`${status}` === '0') {
          return false;
        }

        if (`${status}` === '3') {
          return <Input {...rest} placeholder="请输入异常原因！" />;
        }

        return defaultRender(item);
      },
    },
  ];
  return (
    <ProTable<TableListItem, TableListPagination>
      headerTitle="Select Rule"
      actionRef={actionRef}
      rowKey="key"
      search={{
        labelWidth: 120,
      }}
      toolBarRender={() => []}
      request={rules}
      columns={columns}
      rowSelection={{
        onChange: (_, selectedRows) => {
          setStepData({
            name: selectedRows[0].name,
            ruleDescription: selectedRows[0].ruleDescription,
            ruleId: selectedRows[0].ruleId,
            ruleAction: selectedRows[0].defaultRuleAction,
            thresholdData: selectedRows[0].thresholdData,
          });
          setRuleAction(selectedRows[0].defaultRuleAction);
          setThresholdData(selectedRows[0].thresholdData);
        },
        type: 'radio',
      }}
    />
  );
};
