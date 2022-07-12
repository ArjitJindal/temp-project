import type { ActionType, ProColumns } from '@ant-design/pro-table';
import { useMemo, useRef } from 'react';
import { RuleCreationForm } from './RuleCreationForm';
import { RuleParametersTable } from './RuleParametersTable';
import { Rule, RuleImplementation } from '@/apis';
import { useApi } from '@/api';
import { isFlagrightTenantUser, useAuth0User } from '@/utils/user-utils';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import { RuleActionTag } from '@/components/rules/RuleActionTag';

interface Props {
  onSelectRule: (rule: Rule) => void;
  ruleImplementations: { [ruleImplementationName: string]: RuleImplementation } | undefined;
}

export const RulesTable: React.FC<Props> = ({ ruleImplementations, onSelectRule }) => {
  const user = useAuth0User();
  const api = useApi();
  const actionRef = useRef<ActionType>();
  const columns: ProColumns<Rule>[] = useMemo(
    () => [
      {
        title: 'Rule ID',
        width: 100,
        dataIndex: 'id',
        sorter: (a, b) => parseInt(a.id.split('-')[1]) - parseInt(b.id.split('-')[1]),
        render: (_, entity) => {
          return isFlagrightTenantUser(user) ? (
            <RuleCreationForm rule={entity}>
              <a>{entity.id}</a>
            </RuleCreationForm>
          ) : (
            <span>{entity.id}</span>
          );
        },
      },
      {
        title: 'Rule Name',
        width: 300,
        dataIndex: 'name',
        sorter: (a, b) => a.name.localeCompare(b.name),
        render: (_, entity) => {
          return entity.name;
        },
      },
      {
        title: 'Rule Description',
        width: 500,
        dataIndex: 'description',
      },
      {
        title: 'Default Parameters',
        width: 250,
        render: (_, rule) => (
          <RuleParametersTable
            parameters={rule.defaultParameters}
            schema={ruleImplementations?.[rule.ruleImplementationName].parametersSchema}
          />
        ),
      },
      {
        title: 'Default Action',
        width: 150,
        render: (_, rule) => {
          return (
            <span>
              <RuleActionTag action={rule.defaultAction} />
            </span>
          );
        },
      },
      {
        width: 140,
        search: false,
        fixed: 'right',
        render: (_, entity) => {
          return (
            <span>
              <Button
                analyticsName="Select"
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
    [onSelectRule, ruleImplementations, user],
  );

  return (
    <Table<Rule>
      form={{
        labelWrap: true,
      }}
      headerTitle="Select Rule"
      actionRef={actionRef}
      rowKey="id"
      search={false}
      toolBarRender={() => (isFlagrightTenantUser(user) ? [<RuleCreationForm />] : [])}
      request={async () => {
        const rules = await api.getRules({});
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
