import React, { useState } from 'react';
import { ExpandTabRef } from '../../UserCaseDetails';
import s from './styles.module.less';
import HitsTable from './HitsTable';
import { dayjs, DEFAULT_DATE_TIME_FORMAT } from '@/utils/dayjs';
import * as Card from '@/components/ui/Card';
import { CommonParams, DEFAULT_PARAMS_STATE } from '@/components/ui/Table';
import { Case, CaseTransaction } from '@/apis';
import { transactionType } from '@/utils/tags';
import { TransactionTypeTag } from '@/components/ui/TransactionTypeTag';
import TimestampDisplay from '@/components/ui/TimestampDisplay';
import UserLink from '@/components/UserLink';
import { getUserName } from '@/utils/api/users';
import { PaymentMethodTag } from '@/components/ui/PaymentTypeTag';
import CountryDisplay from '@/components/ui/CountryDisplay';
import Id from '@/components/ui/Id';
import { makeUrl } from '@/utils/routing';
import { useQuery } from '@/utils/queries/hooks';
import { CASES_ITEM_TRANSACTIONS } from '@/utils/queries/keys';
import { useApi } from '@/api';
import QueryResultsTable from '@/components/common/QueryResultsTable';

export function expandedRowRender(transaction: CaseTransaction) {
  return (
    <div className={s.expandedRow}>
      <HitsTable transaction={transaction} />
    </div>
  );
}

interface Props {
  caseItem: Case;
  reference?: React.Ref<ExpandTabRef>;
  updateCollapseState: (key: string, value: boolean) => void;
}

export default function RulesHitCard(props: Props) {
  const { caseItem, updateCollapseState } = props;

  const api = useApi();
  const caseId = caseItem.caseId as string;

  const [params, setParams] = useState<CommonParams>(DEFAULT_PARAMS_STATE);
  const queryResult = useQuery(CASES_ITEM_TRANSACTIONS(caseId, params), async () => {
    const response = await api.getCaseTransactions({
      caseId,
      ...params,
    });
    return {
      total: response.total,
      items: response.data,
    };
  });

  return (
    <Card.Root
      header={{ title: 'Rules Hits', collapsable: true, collapsedByDefault: true }}
      ref={props.reference}
      onCollapseChange={(isCollapsed) => updateCollapseState('rulesHits', isCollapsed)}
    >
      <Card.Section>
        <QueryResultsTable<CaseTransaction, CommonParams>
          disableInternalPadding={true}
          rowKey="transactionId"
          options={{
            reload: false,
            setting: false,
            density: false,
          }}
          search={false}
          scroll={{ x: 2300 }}
          columns={[
            {
              title: 'Transaction ID',
              exportData: 'transactionId',
              width: 100,
              ellipsis: true,
              render: (_, entity) => (
                <Id to={makeUrl(`/transactions/item/:id`, { id: entity.transactionId })}>
                  {entity.transactionId}
                </Id>
              ),
            },
            {
              title: 'Transaction Type',
              dataIndex: 'type',
              exportData: 'type',
              width: 100,
              valueType: 'select',
              ellipsis: true,
              fieldProps: {
                options: transactionType,
                allowClear: true,
              },
              render: (dom, entity) => {
                return <TransactionTypeTag transactionType={entity.type} />;
              },
            },
            {
              title: 'Timestamp',
              width: 130,
              ellipsis: true,
              dataIndex: 'timestamp',
              exportData: (entity) => dayjs(entity.timestamp).format(DEFAULT_DATE_TIME_FORMAT),
              valueType: 'dateTimeRange',
              render: (_, entity) => {
                return <TimestampDisplay timestamp={entity?.timestamp} />;
              },
            },
            {
              title: 'Origin',
              hideInSearch: true,
              children: [
                {
                  title: 'Origin User ID',
                  tooltip: 'Origin is the Sender in a transaction',
                  width: 200,
                  copyable: true,
                  ellipsis: true,
                  dataIndex: 'originUserId',
                  exportData: 'originUserId',
                  hideInSearch: true,
                  render: (dom, entity) => {
                    if (entity == null) {
                      return <></>;
                    }
                    if (!entity.originUser) return entity.originUserId;
                    return (
                      <UserLink user={entity.originUser}>{String(entity.originUserId)}</UserLink>
                    );
                  },
                },
                {
                  title: 'Origin User Name',
                  tooltip: 'Origin is the Sender in a transaction',
                  exportData: (entity) => getUserName(entity.originUser),
                  width: 220,
                  hideInSearch: true,
                  render: (dom, entity) => {
                    return getUserName(entity.originUser);
                  },
                },
                {
                  title: 'Origin Method',
                  width: 160,
                  exportData: 'originPaymentDetails.method',
                  hideInSearch: true,
                  render: (dom, entity) => {
                    return <PaymentMethodTag paymentMethod={entity.originPaymentDetails?.method} />;
                  },
                },
                {
                  title: 'Origin Amount',
                  exportData: 'originAmountDetails.transactionAmount',
                  hideInSearch: true,
                  width: 150,
                  render: (dom, entity) => {
                    if (entity.originAmountDetails?.transactionAmount !== undefined) {
                      return new Intl.NumberFormat().format(
                        entity.originAmountDetails?.transactionAmount,
                      );
                    } else {
                      return entity.originAmountDetails?.transactionAmount;
                    }
                  },
                },
                {
                  title: 'Origin Currency',
                  exportData: 'originAmountDetails.transactionCurrency',
                  hideInSearch: true,
                  width: 140,
                  render: (dom, entity) => {
                    return entity.originAmountDetails?.transactionCurrency;
                  },
                },
                {
                  title: 'Origin Country',
                  exportData: 'originAmountDetails.country',
                  hideInSearch: true,
                  width: 140,
                  render: (dom, entity) => {
                    return <CountryDisplay isoCode={entity.originAmountDetails?.country} />;
                  },
                },
              ],
            },
            {
              title: 'Destination',
              hideInSearch: true,
              children: [
                {
                  title: 'Destination User ID',
                  tooltip: 'Destination is the Receiver in a transaction',
                  dataIndex: 'destinationUserId',
                  exportData: 'destinationUserId',
                  copyable: true,
                  ellipsis: true,
                  hideInSearch: true,
                  width: 170,
                  render: (dom, entity) => {
                    if (!entity.destinationUser) {
                      return entity.destinationUserId;
                    }
                    return (
                      <UserLink user={entity.destinationUser}>
                        {String(entity.destinationUserId)}
                      </UserLink>
                    );
                  },
                },
                {
                  title: 'Destination User Name',
                  tooltip: 'Destination is the Receiver in a transaction',
                  width: 180,
                  hideInSearch: true,
                  exportData: (entity) => getUserName(entity.destinationUser),
                  render: (dom, entity) => {
                    return getUserName(entity.destinationUser);
                  },
                },
                {
                  title: 'Destination Method',
                  exportData: 'destinationPaymentDetails.method',
                  width: 160,
                  hideInSearch: true,
                  render: (dom, entity) => {
                    return (
                      <PaymentMethodTag paymentMethod={entity.destinationPaymentDetails?.method} />
                    );
                  },
                },
                {
                  title: 'Destination Amount',
                  width: 200,
                  dataIndex: 'destnationAmountDetails.transactionAmount',
                  exportData: 'destinationAmountDetails.transactionAmount',
                  hideInSearch: true,
                  render: (dom, entity) => {
                    if (entity.destinationAmountDetails?.transactionAmount !== undefined) {
                      return new Intl.NumberFormat().format(
                        entity.destinationAmountDetails?.transactionAmount,
                      );
                    } else {
                      return entity.destinationAmountDetails?.transactionAmount;
                    }
                  },
                },
                {
                  title: 'Destination Currency',
                  exportData: 'destinationAmountDetails.transactionCurrency',
                  width: 200,
                  hideInSearch: true,
                  render: (dom, entity) => {
                    return entity.destinationAmountDetails?.transactionCurrency;
                  },
                },
                {
                  title: 'Destination Country',
                  exportData: 'destinationAmountDetails.country',
                  width: 200,
                  hideInSearch: true,
                  render: (dom, entity) => {
                    return <CountryDisplay isoCode={entity.destinationAmountDetails?.country} />;
                  },
                },
              ],
            },
          ]}
          queryResults={queryResult}
          params={params}
          onChangeParams={setParams}
          expandable={{ expandedRowRender }}
        />
      </Card.Section>
    </Card.Root>
  );
}
