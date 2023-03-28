import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import SenderReceiverDetails from './SenderReceiverDetails';
import { dayjs, DEFAULT_DATE_TIME_FORMAT } from '@/utils/dayjs';
import { makeUrl } from '@/utils/routing';
import PageWrapper from '@/components/PageWrapper';
import { useI18n } from '@/locales';
import { AsyncResource, failed, init, isSuccess, loading, success } from '@/utils/asyncResource';
import { ApiException, InternalTransaction } from '@/apis';
import { useApi } from '@/api';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import * as Card from '@/components/ui/Card';
import * as Form from '@/components/ui/Form';
import TransactionState from '@/components/ui/TransactionStateTag';
import { RuleActionStatus } from '@/components/ui/RuleActionStatus';
import EntityHeader from '@/components/ui/entityPage/EntityHeader';
import { TransactionTypeTag } from '@/components/ui/TransactionTypeTag';
import TransactionEventsCard from '@/pages/transactions-item/TransactionEventsCard';
import { Feature } from '@/components/AppWrapper/Providers/SettingsProvider';
import { useApiTime, usePageViewTracker } from '@/utils/tracker';
import ActionRiskDisplay from '@/components/ui/ActionRiskDisplay';

export default function TransactionsItem() {
  usePageViewTracker('Transactions Item');
  const i18n = useI18n();
  const [currentItem, setCurrentItem] = useState<AsyncResource<InternalTransaction>>(init());
  const currentTransactionId = isSuccess(currentItem) ? currentItem.value.transactionId : null;
  // const { id: transactionId } = useParams<'id'>();
  const { id: transactionId } = useParams<'id'>();
  const api = useApi();
  const measure = useApiTime();
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
    measure(
      () =>
        api.getTransaction({
          transactionId,
        }),
      'Get Transaction',
    )
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
  }, [currentTransactionId, transactionId, api, measure]);

  return (
    <PageWrapper
      backButton={{
        title: i18n('menu.transactions.transactions-list'),
        url: makeUrl('/transactions/list'),
      }}
    >
      <Card.Root>
        <AsyncResourceRenderer resource={currentItem}>
          {(transaction) => (
            <>
              <EntityHeader
                id={transaction.transactionId}
                idTitle="Transaction ID"
                buttons={
                  <>
                    <Feature name="PULSE">
                      <ActionRiskDisplay transactionId={transaction.transactionId} />
                    </Feature>
                  </>
                }
              >
                <Form.Layout.Label title="Time">
                  {dayjs(transaction.timestamp).format(DEFAULT_DATE_TIME_FORMAT)}
                </Form.Layout.Label>
                <Form.Layout.Label title="State">
                  <TransactionState transactionState={transaction.transactionState} />
                </Form.Layout.Label>
                <Form.Layout.Label title="Rule action">
                  {transaction.status && <RuleActionStatus ruleAction={transaction.status} />}
                </Form.Layout.Label>
                <Form.Layout.Label title="Type">
                  <TransactionTypeTag transactionType={transaction.type} />
                </Form.Layout.Label>
                <Form.Layout.Label title="Reference">
                  {transaction.reference ?? '-'}
                </Form.Layout.Label>
              </EntityHeader>
              <Card.Section>
                <SenderReceiverDetails transaction={transaction} />
                <TransactionEventsCard events={transaction.events ?? []} />
              </Card.Section>
            </>
          )}
        </AsyncResourceRenderer>
      </Card.Root>
    </PageWrapper>
  );
}
