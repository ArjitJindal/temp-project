import React, { useMemo } from 'react';
import s from './styles.module.less';
import { Alert, InternalTransaction } from '@/apis';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { useApi } from '@/api';
import { usePaginatedQuery } from '@/utils/queries/hooks';
import { ALERT_LIST } from '@/utils/queries/keys';
import QueryResultsTable from '@/components/common/QueryResultsTable';
import Id from '@/components/ui/Id';
import { getRuleInstanceDisplayId } from '@/pages/rules/utils';
import { makeUrl } from '@/utils/routing';
import { P } from '@/components/ui/Typography';

interface Props {
  transaction: InternalTransaction;
}

export default function ApprovalDetails(props: Props) {
  const { transaction } = props;

  const api = useApi();
  const params = useMemo(
    () => ({
      filterTransactionId: transaction.transactionId,
    }),
    [transaction.transactionId],
  );
  const queryResults = usePaginatedQuery<Alert>(ALERT_LIST(params), async ({ page }) => {
    const response = await api.getAlertList({
      ...params,
      page: page,
    });
    return {
      items: response.data.map(({ alert }) => alert),
      total: response.total,
    };
  });

  return (
    <div>
      <P bold={true} className={s.title}>
        {'Rule & Case details'}
      </P>
      <QueryResultsTable<Alert>
        rowKey={'alertId'}
        columns={columns}
        queryResults={queryResults}
        externalHeader={true}
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
    key: 'caseId',
    title: 'Case ID',
    defaultWidth: 150,
    type: {
      render: (caseId) => (
        <Id to={caseId ? makeUrl('/case-management/case/:id', { id: caseId }) : undefined}>
          {caseId}
        </Id>
      ),
    },
  }),
  columnHelper.simple({
    key: 'alertId',
    title: 'Alert ID',
    defaultWidth: 150,
    type: {
      render: (alertId, { item: alert }) => (
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
