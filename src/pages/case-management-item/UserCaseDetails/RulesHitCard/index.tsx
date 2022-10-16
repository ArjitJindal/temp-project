import React from 'react';
import s from './styles.module.less';
import HitsTable from './HitsTable';
import * as Card from '@/components/ui/Card';
import Table from '@/components/ui/Table';
import { CaseTransaction } from '@/apis';
import { transactionType } from '@/utils/tags';
import { TransactionTypeTag } from '@/components/ui/TransactionTypeTag';
import TimestampDisplay from '@/components/ui/TimestampDisplay';
import UserLink from '@/components/UserLink';
import { getUserName } from '@/utils/api/users';
import { PaymentMethodTag } from '@/components/ui/PaymentTypeTag';
import CountryDisplay from '@/components/ui/CountryDisplay';
import Id from '@/components/ui/Id';
import { makeUrl } from '@/utils/routing';

export function expandedRowRender(transaction: CaseTransaction) {
  return (
    <div className={s.expandedRow}>
      <HitsTable transaction={transaction} />
    </div>
  );
}

interface Props {
  transactions: CaseTransaction[];
}

export default function RulesHitCard(props: Props) {
  const { transactions } = props;

  return (
    <Card.Root
      header={{
        title: 'Rules Hits',
        collapsable: true,
        collapsedByDefault: false,
      }}
    >
      <Card.Section>
        <Table<CaseTransaction>
          disableInternalPadding={true}
          rowKey="transactionId"
          options={{
            reload: false,
            setting: false,
            density: false,
          }}
          search={false}
          pagination={false}
          scroll={{ x: 2300 }}
          columns={[
            {
              title: 'Transaction ID',
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
                  width: 220,
                  hideInSearch: true,
                  render: (dom, entity) => {
                    return getUserName(entity.originUser);
                  },
                },
                {
                  title: 'Origin Method',
                  width: 160,
                  hideInSearch: true,
                  render: (dom, entity) => {
                    return <PaymentMethodTag paymentMethod={entity.originPaymentDetails?.method} />;
                  },
                },
                {
                  title: 'Origin Amount',
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
                  hideInSearch: true,
                  width: 140,
                  render: (dom, entity) => {
                    return entity.originAmountDetails?.transactionCurrency;
                  },
                },
                {
                  title: 'Origin Country',
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
                  render: (dom, entity) => {
                    return getUserName(entity.destinationUser);
                  },
                },
                {
                  title: 'Destination Method',
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
                  width: 200,
                  hideInSearch: true,
                  render: (dom, entity) => {
                    return entity.destinationAmountDetails?.transactionCurrency;
                  },
                },
                {
                  title: 'Destination Country',
                  width: 200,
                  hideInSearch: true,
                  render: (dom, entity) => {
                    return <CountryDisplay isoCode={entity.destinationAmountDetails?.country} />;
                  },
                },
              ],
            },
          ]}
          data={{ items: transactions }}
          expandable={{ expandedRowRender }}
        />
      </Card.Section>
    </Card.Root>
  );
}
