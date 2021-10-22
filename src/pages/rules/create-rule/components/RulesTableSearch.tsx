import type { ProColumns, ActionType } from '@ant-design/pro-table';
import ProTable from '@ant-design/pro-table';
import { Input, Tag } from 'antd';
import { Dispatch, SetStateAction, useRef } from 'react';
import { StepDataType, TableListPagination } from '../data.d';

import type { RuleAction, RuleTemplateTableListItem, ThresholdDataType } from '../../data.d';
import { actionToColor } from '../../data.d';

import { rules } from '../service';

export const RulesTableSearch: React.FC<{
  setStepData: Dispatch<SetStateAction<StepDataType>>;
  setRuleAction: Dispatch<SetStateAction<RuleAction>>;
  setThresholdData: Dispatch<SetStateAction<ThresholdDataType[]>>;
}> = ({ setStepData, setRuleAction, setThresholdData }) => {
  const actionRef = useRef<ActionType>();

  const columns: ProColumns<RuleTemplateTableListItem>[] = [
    {
      title: 'Rule name',
      dataIndex: 'name',
      tip: 'RuleName key',
      renderText: (dom: string) => `${dom}`,
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
    <ProTable<RuleTemplateTableListItem, TableListPagination>
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
