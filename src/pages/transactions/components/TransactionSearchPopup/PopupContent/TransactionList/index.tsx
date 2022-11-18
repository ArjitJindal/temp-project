import React from 'react';
import pluralize from 'pluralize';
import { List, Spin } from 'antd';
import s from './style.module.less';
import TransactionItem from './TransactionItem';
import { AsyncResource } from '@/utils/asyncResource';
import { Transaction } from '@/apis';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';

interface Props {
  selectedTransaction: Transaction | null;
  onSelectTransaction: (transaction: Transaction) => void;
  search: string;
  transactionRes: AsyncResource<{
    total: number;
    transactions: Transaction[];
  }>;
}

export default function TransactionList(props: Props) {
  const { selectedTransaction, onSelectTransaction, search, transactionRes } = props;

  // todo: i18n
  return (
    <div className={s.root}>
      <div
        id="scrollableDiv"
        style={{
          maxHeight: 200,
          overflow: 'auto',
        }}
      >
        <AsyncResourceRenderer
          resource={transactionRes}
          renderLoading={() => (
            <div className={s.spinner}>
              <Spin />
            </div>
          )}
        >
          {({ transactions, total }) => (
            <>
              {renderMessage(transactions, total, search)}
              {transactions.length > 0 && (
                <List<Transaction>
                  dataSource={transactions}
                  renderItem={(nextTransaction) => (
                    <TransactionItem
                      transaction={nextTransaction}
                      key={nextTransaction.transactionId}
                      isActive={
                        nextTransaction.transactionId === selectedTransaction?.transactionId
                      }
                      onClick={() => {
                        onSelectTransaction(nextTransaction);
                      }}
                    />
                  )}
                />
              )}
            </>
          )}
        </AsyncResourceRenderer>
      </div>
    </div>
  );
}

function renderMessage(transactions: Transaction[], total: number, search: string) {
  const length = transactions.length;
  if (length === 0) {
    return (
      <div className={s.nothingFound}>
        We could not find a transaction with the search term "{search}"
      </div>
    );
  }
  if (total > length) {
    return <div className={s.subtitle}>More than {length} transactions found</div>;
  }
  return <div className={s.subtitle}>{pluralize('transaction', length, true)} found</div>;
}
