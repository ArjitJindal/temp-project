import React, { useMemo, useState } from 'react';
import s from './styles.module.less';
import { Alert, InternalTransaction, RuleAction, RuleInstance } from '@/apis';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { useApi } from '@/api';
import { usePaginatedQuery } from '@/utils/queries/hooks';
import { ALERT_LIST } from '@/utils/queries/keys';
import QueryResultsTable from '@/components/common/QueryResultsTable';
import Id from '@/components/ui/Id';
import { getRuleInstanceDisplayId } from '@/pages/rules/utils';
import { makeUrl } from '@/utils/routing';
import { P } from '@/components/ui/Typography';
import { DefaultApiGetAlertListRequest } from '@/apis/types/ObjectParamAPI';
import { AllParams } from '@/components/library/Table/types';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { useRules } from '@/utils/rules';

type TableParams = AllParams<DefaultApiGetAlertListRequest>;

interface Props {
  transaction: InternalTransaction;
  action?: RuleAction;
}

export default function RuleAndCaseDetails(props: Props) {
  const { transaction, action } = props;

  const api = useApi();
  const [params, setParams] = useState<TableParams>(DEFAULT_PARAMS_STATE);
  const fullParams = useMemo(
    () => ({
      ...params,
      filterTransactionId: transaction.transactionId,
    }),
    [params, transaction.transactionId],
  );
  const queryResults = usePaginatedQuery<Alert>(ALERT_LIST(fullParams), async ({ page }) => {
    const response = await api.getAlertList({
      ...fullParams,
      page: page ?? fullParams.page,
      filterAction: action ? action : undefined,
    });
    return {
      items: response.data.map(({ alert }) => alert),
      total: response.total,
    };
  });

  const rules = useRules();
  const ruleOptions = useMemo(() => {
    return Object.values(rules.ruleInstances).map((rulesInstance: RuleInstance) => {
      const ruleName = rulesInstance.ruleNameAlias || rules.rules[rulesInstance.ruleId]?.name;
      return {
        value: rulesInstance.id ?? '',
        label: `${ruleName} ${rulesInstance.ruleId} (${rulesInstance.id})`,
      };
    });
  }, [rules.ruleInstances, rules.rules]);

  return (
    <div>
      <P bold={true} className={s.title}>
        {'Rule & Case details'}
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
              options: ruleOptions,
            },
          },
        ]}
      />
    </div>
  );
}

const columnHelper = new ColumnHelper<Alert>();

const columns = columnHelper.list([
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
      render: (alertId: string | undefined, { item: alert }) => (
        <Id
          to={
            alert.caseId
              ? makeUrl('/case-management/case/:id/:tab', {
                  id: alert.caseId,
                  tab: 'alerts',
                })
              : undefined
          }
        >
          {alertId}
        </Id>
      ),
    },
  }),
]);
