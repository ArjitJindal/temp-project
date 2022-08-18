import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { Card } from 'antd';
import { TransactionDetails } from './components/TransactionDetails';
import { ApiException, TransactionCaseManagement } from '@/apis';
import { useApi } from '@/api';
import { AsyncResource, failed, init, loading, success } from '@/utils/asyncResource';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import PageWrapper from '@/components/PageWrapper';
import { useI18n } from '@/locales';
import { makeUrl } from '@/utils/routing';

export type CaseManagementItem = TransactionCaseManagement & {
  index: number;
  transactionId?: string;
  isFirstRow: boolean;
  isLastRow: boolean;
  rowSpan: number;
  ruleName: string | null;
  ruleDescription: string | null;
  rowKey: string;
};

function TableList() {
  const { id: transactionId } = useParams<'id'>();
  const [currentItem, setCurrentItem] = useState<AsyncResource<TransactionCaseManagement>>(init());
  const [updatedTransactions, setUpdatedTransactions] = useState<{
    [key: string]: TransactionCaseManagement;
  }>({});
  const handleTransactionUpdate = useCallback(async (newTransaction: TransactionCaseManagement) => {
    const transactionId = newTransaction.transactionId as string;
    setUpdatedTransactions((prev) => ({
      ...prev,
      [transactionId]: newTransaction,
    }));
  }, []);
  const api = useApi();
  // const currentTransactionId = isSuccess(currentItem) ? currentItem.value.transactionId : null;
  useEffect(() => {
    if (transactionId == null) {
      setCurrentItem(failed(`Transaction id is not specified`));
      return;
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
  }, [transactionId, api]);

  const i18n = useI18n();

  return (
    <PageWrapper
      backButton={{
        title: i18n('menu.case-management.item.back-button'),
        url: makeUrl('/case-management'),
      }}
    >
      <Card>
        <AsyncResourceRenderer resource={currentItem}>
          {(transaction) => (
            <TransactionDetails
              transaction={
                (transaction.transactionId
                  ? updatedTransactions[transaction.transactionId]
                  : null) ?? transaction
              }
              onTransactionUpdate={handleTransactionUpdate}
            />
          )}
        </AsyncResourceRenderer>
      </Card>
    </PageWrapper>
  );
}
export default TableList;
