import { Card } from 'antd';
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { makeUrl } from '@/utils/routing';
import PageWrapper from '@/components/PageWrapper';
import { useI18n } from '@/locales';
import { TransactionDetails } from '@/pages/case-management-item/components/TransactionDetails';
import { AsyncResource, failed, init, isSuccess, loading, success } from '@/utils/asyncResource';
import { ApiException, TransactionCaseManagement } from '@/apis';
import { useApi } from '@/api';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';

export default function TransactionsItem() {
  const i18n = useI18n();
  const [currentItem, setCurrentItem] = useState<AsyncResource<TransactionCaseManagement>>(init());
  const currentTransactionId = isSuccess(currentItem) ? currentItem.value.transactionId : null;
  // const { id: transactionId } = useParams<'id'>();
  const { id: transactionId } = useParams<'id'>();
  const api = useApi();

  useEffect(() => {
    if (transactionId == null || transactionId === 'all') {
      setCurrentItem(init());
      return function () {};
    }
    if (currentTransactionId === transactionId) {
      return function () {};
    }
    setCurrentItem(loading());
    let isCanceled = false;
    api
      .getTransaction({
        transactionId,
      })
      .then((transaction) => {
        if (isCanceled) {
          return;
        }
        setCurrentItem(success(transaction));
      })
      .catch((e) => {
        if (isCanceled) {
          return;
        }
        // todo: i18n
        let message = 'Unknown error';
        if (e instanceof ApiException && e.code === 404) {
          message = `Unable to find transaction by id "${transactionId}"`;
        } else if (e instanceof Error && e.message) {
          message = e.message;
        }
        setCurrentItem(failed(message));
      });
    return () => {
      isCanceled = true;
    };
  }, [currentTransactionId, transactionId, api]);

  return (
    <PageWrapper
      backButton={{
        title: i18n('menu.transactions.transactions-list'),
        url: makeUrl('/transactions/list'),
      }}
    >
      <Card>
        <AsyncResourceRenderer resource={currentItem}>
          {(transaction) => (
            <TransactionDetails transaction={transaction} isTransactionView={true} />
          )}
        </AsyncResourceRenderer>
      </Card>
    </PageWrapper>
  );
}
