import { useCallback, useMemo } from 'react';
import style from '../style.module.less';
import { RuleCreationForm } from './RuleCreationForm';
import { RuleParametersTable } from './RuleParametersTable';
import { Rule, RuleImplementation } from '@/apis';
import { useApi } from '@/api';
import { isAtLeast, useAuth0User, UserRole } from '@/utils/user-utils';
import Button from '@/components/ui/Button';
import { RequestTable } from '@/components/RequestTable';
import { RuleActionTag } from '@/components/rules/RuleActionTag';
import { TableColumn } from '@/components/ui/Table/types';
import { useFeature } from '@/components/AppWrapper/Providers/SettingsProvider';

interface Props {
  onSelectRule: (rule: Rule) => void;
  ruleImplementations: { [ruleImplementationName: string]: RuleImplementation } | undefined;
}

export const RulesTable: React.FC<Props> = ({ ruleImplementations, onSelectRule }) => {
  const user = useAuth0User();
  const api = useApi();
  const isCaseCreationTypeEnabled = useFeature('CASE_CREATION_TYPE');
  const columns: TableColumn<Rule>[] = useMemo(() => {
    const caseCreationHeaders: TableColumn<Rule>[] = [
      {
        title: 'Rule Case Creation Type',
        width: 150,
        dataIndex: 'defaultCaseCreationType',
      },
      {
        title: 'Rule Case Priority',
        width: 100,
        dataIndex: 'defaultCasePriority',
      },
    ];
    return [
      {
        title: 'Rule ID',
        width: 100,
        dataIndex: 'id',
        sorter: (a, b) => parseInt(a.id.split('-')[1]) - parseInt(b.id.split('-')[1]),
        defaultSortOrder: 'ascend',
        render: (_, entity) => {
          return isAtLeast(user, UserRole.ROOT) ? (
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
      ...(isCaseCreationTypeEnabled ? caseCreationHeaders : []),
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
        sorter: (a, b) => a.defaultAction.localeCompare(b.defaultAction),
        render: (_, rule) => {
          return (
            <span>
              <RuleActionTag ruleAction={rule.defaultAction} />
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
    ];
  }, [onSelectRule, ruleImplementations, user, isCaseCreationTypeEnabled]);

  const request = useCallback(async () => {
    const rules = await api.getRules({});
    return {
      items: rules,
      success: true,
      total: rules.length,
    };
  }, [api]);

  return (
    <RequestTable<Rule>
      form={{
        labelWrap: true,
      }}
      headerTitle="Select Rule"
      className={style.table}
      scroll={{ x: 1300 }}
      pagination={false}
      rowKey="id"
      search={false}
      toolBarRender={() => (isAtLeast(user, UserRole.ROOT) ? [<RuleCreationForm />] : [])}
      request={request}
      columns={columns}
    />
  );
};
