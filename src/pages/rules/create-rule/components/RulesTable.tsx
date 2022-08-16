import type { ProColumns } from '@ant-design/pro-table';
import { useCallback, useMemo, useState } from 'react';
import style from '../style.module.less';
import { RuleCreationForm } from './RuleCreationForm';
import { RuleParametersTable } from './RuleParametersTable';
import { Rule, RuleImplementation } from '@/apis';
import { useApi } from '@/api';
import { isAtLeast, useAuth0User, UserRole } from '@/utils/user-utils';
import Button from '@/components/ui/Button';
import { Table } from '@/components/ui/Table';
import { RuleActionTag } from '@/components/rules/RuleActionTag';
import ResizableTitle from '@/utils/table-utils';
import handleResize from '@/components/ui/Table/utils';

interface Props {
  onSelectRule: (rule: Rule) => void;
  ruleImplementations: { [ruleImplementationName: string]: RuleImplementation } | undefined;
}

export const RulesTable: React.FC<Props> = ({ ruleImplementations, onSelectRule }) => {
  const user = useAuth0User();
  const api = useApi();
  const [updatedColumnWidth, setUpdatedColumnWidth] = useState<{
    [key: number]: number;
  }>({});
  const columns: ProColumns<Rule>[] = useMemo(
    () => [
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
    ],
    [onSelectRule, ruleImplementations, user],
  );

  const mergeColumns: ProColumns<Rule>[] = columns.map((col, index) => ({
    ...col,
    width: updatedColumnWidth[index] || col.width,
    onHeaderCell: (column) => ({
      width: (column as ProColumns<Rule>).width,
      onResize: handleResize(index, setUpdatedColumnWidth),
    }),
  }));
  const request = useCallback(async () => {
    const rules = await api.getRules({});
    return {
      data: rules,
      success: true,
      total: rules.length,
    };
  }, [api]);

  return (
    <Table<Rule>
      form={{
        labelWrap: true,
      }}
      headerTitle="Select Rule"
      components={{
        header: {
          cell: ResizableTitle,
        },
      }}
      className={style.table}
      rowClassName={(_, index) => {
        return index % 2 === 0 ? style.tableRowLight : `${style.tableRowDark} ${style.rowDark}`;
      }}
      scroll={{ x: 1300 }}
      pagination={false}
      rowKey="id"
      search={false}
      toolBarRender={() => (isAtLeast(user, UserRole.ROOT) ? [<RuleCreationForm />] : [])}
      request={request}
      columns={mergeColumns}
    />
  );
};
