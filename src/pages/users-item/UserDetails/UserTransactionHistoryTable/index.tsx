import { useState } from 'react';
import { Link } from 'react-router-dom';
import style from './style.module.less';
import { prepareTableData } from './helpers';
import * as Card from '@/components/ui/Card';
import TransactionEventsTable from '@/pages/transactions-item/TransactionEventsTable';
import {
  Amount,
  RiskLevel,
  RuleAction,
  TransactionAmountDetails,
  TransactionEvent,
  TransactionState,
} from '@/apis';
import { useApi } from '@/api';
import { DefaultApiGetTransactionsListRequest } from '@/apis/types/ObjectParamAPI';
import { useQuery } from '@/utils/queries/hooks';
import QueryResultsTable from '@/components/common/QueryResultsTable';
import { AllParams } from '@/components/library/Table/types';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { USERS_ITEM_TRANSACTIONS_HISTORY } from '@/utils/queries/keys';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import {
  COUNTRY,
  DATE,
  FLOAT,
  MONEY,
  RISK_LEVEL,
  RULE_ACTION_STATUS,
  TRANSACTION_STATE,
} from '@/components/library/Table/standardDataTypes';
import { makeUrl } from '@/utils/routing';

export type DataItem = {
  index: number;
  status?: RuleAction;
  rowKey: string;
  lastRowKey: string;
  transactionId?: string;
  timestamp?: number;
  originAmountDetails?: TransactionAmountDetails;
  destinationAmountDetails?: TransactionAmountDetails;
  direction?: 'Incoming' | 'Outgoing';
  events: Array<TransactionEvent>;
  ruleName: string | null;
  ruleDescription: string | null;
  arsRiskLevel?: RiskLevel;
  arsScore?: number;
};

export function Content(props: { userId: string }) {
  const { userId } = props;
  const api = useApi();
  const isPulseEnabled = useFeatureEnabled('PULSE');

  const [params, setParams] = useState<AllParams<DefaultApiGetTransactionsListRequest>>({
    ...DEFAULT_PARAMS_STATE,
    includeEvents: true,
    beforeTimestamp: Date.now(),
  });

  const responseRes = useQuery(USERS_ITEM_TRANSACTIONS_HISTORY(userId, params), async () => {
    const [sortField, sortOrder] = params.sort[0] ?? [];

    const directionFilter = (params ?? {})['direction'] ?? [];
    const showIncoming = directionFilter.indexOf('incoming') !== -1;
    const showOutgoing = directionFilter.indexOf('outgoing') !== -1;

    const statusFilter = (params ?? {})['status'] ?? [];

    const newParams: DefaultApiGetTransactionsListRequest = {
      ...params,
      beforeTimestamp: Date.now(),
      sortField: sortField ?? undefined,
      sortOrder: sortOrder ?? undefined,
      includeEvents: true,
    };

    if (showOutgoing) {
      newParams.filterOriginUserId = userId;
    } else if (showIncoming) {
      newParams.filterDestinationUserId = userId;
    } else {
      newParams.filterUserId = userId;
    }

    if (statusFilter.indexOf('ALLOW') !== -1) {
      newParams.filterStatus = ['ALLOW'];
    } else if (statusFilter.indexOf('FLAG') !== -1) {
      newParams.filterStatus = ['FLAG'];
    } else if (statusFilter.indexOf('BLOCK') !== -1) {
      newParams.filterStatus = ['BLOCK'];
    } else if (statusFilter.indexOf('SUSPEND') !== -1) {
      newParams.filterStatus = ['SUSPEND'];
    }

    return api.getTransactionsList(newParams).then((result) => ({
      total: result.total,
      items: prepareTableData(userId, result.data ?? []),
    }));
  });

  const helper = new ColumnHelper<DataItem>();

  return (
    <QueryResultsTable<DataItem>
      rowKey="rowKey"
      params={params}
      onChangeParams={setParams}
      queryResults={responseRes}
      columns={helper.list([
        helper.simple<'transactionId'>({
          title: 'Transaction ID',
          key: 'transactionId',
          type: {
            render: (transactionId) => {
              return (
                <div className={style.idColumn}>
                  <Link to={makeUrl(`/transactions/item/:id`, { id: transactionId ?? '' })}>
                    {transactionId}
                  </Link>
                </div>
              );
            },
          },
        }),
        ...(isPulseEnabled
          ? [
              helper.simple({
                title: 'TRS score',
                key: 'arsScore',
                id: 'arsScore.arsScore',
                type: FLOAT,
                sorting: true,
                tooltip: 'Transaction Risk Score',
                // dataIndex: 'arsScore.arsScore',
                // exportData: 'arsScore',
                // render: (_, entity) => entity?.arsScore?.toFixed(2),
                // onCell: (_) => ({
                //   rowSpan: _.isFirstRow ? _.rowsCount : 0,
                // }),
              }),
              helper.simple<'arsRiskLevel'>({
                title: 'TRS level',
                type: RISK_LEVEL,
                key: 'arsRiskLevel',
                sorting: true,
                // dataIndex: 'arsScore.arsScore',
                // exportData: 'arsRiskLevel',
                // render: (_, entity) => {
                //   return <RiskLevelTag level={entity?.arsRiskLevel} />;
                // },
                // onCell: (_) => ({
                //   rowSpan: _.isFirstRow ? _.rowsCount : 0,
                // }),
                tooltip: 'Transaction Risk Score level',
              }),
            ]
          : []),
        helper.simple<'ruleName'>({
          title: 'Rules Hit',
          key: 'ruleName',
        }),
        helper.simple<'ruleDescription'>({
          title: 'Rules Description',
          tooltip: 'Describes the conditions required for this rule to be hit.',
          key: 'ruleDescription',
        }),
        helper.derived<TransactionState>({
          id: 'lastTransactionState',
          title: 'Last transaction state',
          value: (entity) => entity.events?.[entity.events.length - 1]?.transactionState,
          type: TRANSACTION_STATE,
        }),
        helper.simple<'timestamp'>({
          title: 'Transaction Time',
          key: 'timestamp',
          type: DATE,
        }),
        helper.simple<'status'>({
          key: 'status',
          title: 'Status',
          type: RULE_ACTION_STATUS,
          sorting: true,
          filtering: true,
        }),
        helper.simple<'direction'>({
          title: 'Transaction Direction',
          key: 'direction',
          type: {
            autoFilterDataType: {
              kind: 'select',
              options: [
                { value: 'all', label: 'All' },
                { value: 'incoming', label: 'Incoming' },
                { value: 'outgoing', label: 'Outgoing' },
              ],
              mode: 'SINGLE',
              displayMode: 'select',
            },
          },
          filtering: true,
        }),
        helper.group({
          title: 'Origin',
          tooltip: 'Origin is the Sender in a transaction',
          children: helper.list([
            helper.derived<Amount>({
              id: 'originAmount',
              title: 'Origin Amount',
              value: (entity): Amount | undefined => {
                if (entity.originAmountDetails == null) {
                  return undefined;
                }
                return {
                  amountValue: entity.originAmountDetails?.transactionAmount,
                  amountCurrency: entity.originAmountDetails?.transactionCurrency,
                };
              },
              type: MONEY,
            }),
            helper.simple<'originAmountDetails.country'>({
              id: 'originCountry',
              title: 'Origin Country',
              key: 'originAmountDetails.country',
              type: COUNTRY,
            }),
          ]),
        }),
        helper.group({
          title: 'Destination',
          tooltip: 'Destination is the Receiver in a transaction',
          children: helper.list([
            helper.derived({
              id: 'destinationAmount',
              title: 'Destination amount',
              value: (entity): Amount | undefined => {
                if (entity.originAmountDetails == null) {
                  return undefined;
                }
                return {
                  amountValue: entity.originAmountDetails?.transactionAmount,
                  amountCurrency: entity.originAmountDetails?.transactionCurrency,
                };
              },
              type: MONEY,
            }),
            helper.simple<'destinationAmountDetails.country'>({
              id: 'destinationCountry',
              title: 'Destination country',
              key: 'destinationAmountDetails.country',
              type: COUNTRY,
            }),
          ]),
        }),
      ])}
      renderExpanded={(item) => <TransactionEventsTable events={item.events} />}
      fixedExpandedContainer={true}
      fitHeight={true}
    />
  );
}

interface Props {
  userId: string | undefined;
  updateCollapseState?: (key: string, value: boolean) => void;
  title?: string;
  collapsableKey?: string;
}

export default function UserTransactionHistoryTable(props: Props) {
  const { userId, updateCollapseState, title, collapsableKey } = props;
  return (
    <Card.Root
      className={style.root}
      disabled={userId == null}
      header={title != null ? { title, collapsableKey } : undefined}
      updateCollapseState={updateCollapseState}
    >
      {userId && (
        <Card.Section>
          <Content userId={userId} />
        </Card.Section>
      )}
    </Card.Root>
  );
}
