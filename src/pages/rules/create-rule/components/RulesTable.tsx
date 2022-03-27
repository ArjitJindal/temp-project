import type { ProColumns, ActionType } from '@ant-design/pro-table';
import ProTable from '@ant-design/pro-table';
import { useMemo, useRef } from 'react';
import { Button, Tag } from 'antd';

import { useAuth0 } from '@auth0/auth0-react';
import { getRuleActionColor } from '../../utils';
import { RuleCreationForm } from './RuleCreationForm';
import { Rule } from '@/apis';
import { useApi } from '@/api';
import { isFlagrightUser } from '@/utils/user-utils';

interface Props {
  onSelectRule: (rule: Rule) => void;
}

export const RulesTable: React.FC<Props> = ({ onSelectRule }) => {
  const { user } = useAuth0();
  const api = useApi();
  const actionRef = useRef<ActionType>();
  const columns: ProColumns<Rule>[] = useMemo(
    () => [
      {
        title: 'Rule ID',
        width: 100,
        dataIndex: 'id',
        sorter: true,
      },
      {
        title: 'Rule Name',
        width: 300,
        dataIndex: 'name',
        sorter: true,
      },
      {
        title: 'Rule Description',
        width: 500,
        dataIndex: 'description',
      },
      {
        title: 'Default Action',
        width: 150,
        dataIndex: 'defaultAction',
        render: (_, rule) => {
          return (
            <span>
              <Tag color={getRuleActionColor(rule.defaultAction)}>{rule.defaultAction}</Tag>
            </span>
          );
        },
      },
      {
        width: 140,
        dataIndex: 'status',
        search: false,
        key: 'status',
        fixed: 'right',
        render: (_, entity) => {
          return (
            <span>
              <Button
                shape="round"
                size="small"
                style={{ borderColor: '#1890ff', color: '#1890ff' }}
                onClick={() => onSelectRule(entity)}
              >
                Select
              </Button>
            </span>
          );
        },
      },
    ],
    [onSelectRule],
  );

  return (
    <ProTable<Rule>
      headerTitle="Select Rule"
      actionRef={actionRef}
      rowKey="id"
      search={{
        labelWidth: 30,
      }}
      toolBarRender={() => (user && isFlagrightUser(user) ? [<RuleCreationForm />] : [])}
      request={async () => {
        const rules = await api.getRules();
        return {
          data: rules,
          success: true,
          total: rules.length,
        };
      }}
      columns={columns}
    />
  );
};
