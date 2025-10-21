import React, { useState } from 'react';
import s from './styles.module.less';
import { Alert, InternalTransaction, RuleAction } from '@/apis';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import Id from '@/components/ui/Id';
import { getRuleInstanceDisplayId } from '@/pages/rules/utils';
import { makeUrl } from '@/utils/routing';
import { P } from '@/components/ui/Typography';
import { DefaultApiGetAlertListRequest } from '@/apis/types/ObjectParamAPI';
import { AllParams } from '@/components/library/Table/types';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { useRuleOptions } from '@/utils/rules';
import { PRIORITY } from '@/components/library/Table/standardDataTypes';
import { useAlertList } from '@/utils/api/alerts';
type TableParams = AllParams<DefaultApiGetAlertListRequest>;

interface Props {
  transaction: InternalTransaction;
  action?: RuleAction;
}

export default function RuleAndCaseDetails(props: Props) {
  const { transaction, action } = props;

  const [params, setParams] = useState<TableParams>(DEFAULT_PARAMS_STATE);

  const queryResults = useAlertList(params, {
    filterRuleInstanceId: action
      ? transaction.hitRules
          .filter((rule) => rule.ruleInstanceId && rule.ruleAction === action)
          .map((rule) => rule.ruleInstanceId)
      : undefined,
    filterTransactionIds: [transaction.transactionId],
  });

  const ruleOptions = useRuleOptions();
  const columns = useColumns();
  return (
    <div>
      <P bold={true} className={s.title}>
        Rule & Case details
      </P>
      <QueryResultsTable<Alert, TableParams>
        rowKey={'alertId'}
        columns={columns}
        queryResults={queryResults}
        params={params}
        pagination={true}
        onChangeParams={setParams}
        extraFilters={[
          {
            key: 'filterRulesHit',
            title: 'Rule',
            renderer: {
              kind: 'select',
              mode: 'MULTIPLE',
              displayMode: 'select',
              options: ruleOptions.filter(Boolean) as { value: string; label: string }[],
            },
          },
        ]}
      />
    </div>
  );
}

const columnHelper = new ColumnHelper<Alert>();

const useColumns = () => {
  return columnHelper.list([
    columnHelper.simple({ title: '', key: 'priority', defaultWidth: 40, type: PRIORITY }),
    columnHelper.simple({ key: 'ruleName', title: 'Rule name', defaultWidth: 300 }),
    columnHelper.simple({ key: 'ruleDescription', title: 'Rule description', defaultWidth: 400 }),
    columnHelper.derived({
      id: 'ruleInstanceId',
      value: (item) => getRuleInstanceDisplayId(item.ruleId, item.ruleInstanceId),
      title: 'Rule ID',
      defaultWidth: 150,
      type: {
        render: (id, context) => {
          return (
            <Id
              to={makeUrl('/rules/my-rules/:ruleInstanceId', {
                ruleInstanceId: context.item.ruleInstanceId,
              })}
            >
              {id}
            </Id>
          );
        },
      },
    }),
    columnHelper.simple({
      id: 'filterCaseId',
      key: 'caseId' as const,
      title: 'Case ID',
      defaultWidth: 150,
      filtering: true,
      showFilterByDefault: true,
      type: {
        render: (caseId) => (
          <Id to={caseId ? makeUrl('/case-management/case/:id', { id: caseId }) : undefined}>
            {caseId}
          </Id>
        ),
      },
    }),
    columnHelper.simple({
      id: 'filterAlertId',
      key: 'alertId' as const,
      title: 'Alert ID',
      filtering: true,
      showFilterByDefault: true,
      defaultWidth: 150,
      type: {
        render: (alertId: string | undefined, { item: _alert }) => {
          const url = makeUrl('case-management/alerts/:id', { id: alertId });
          return <Id to={url}>{alertId}</Id>;
        },
      },
    }),
  ]);
};
