import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import moment from 'moment';
import SenderReceiverDetails from './SenderReceiverDetails';
import { makeUrl } from '@/utils/routing';
import PageWrapper from '@/components/PageWrapper';
import { useI18n } from '@/locales';
import { AsyncResource, failed, init, isSuccess, loading, success } from '@/utils/asyncResource';
import { ApiException, TransactionCaseManagement } from '@/apis';
import { useApi } from '@/api';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import * as Card from '@/components/ui/Card';
import * as Form from '@/components/ui/Form';
import TimerLineIcon from '@/components/ui/icons/Remix/system/timer-line.react.svg';
import RestartLineIcon from '@/components/ui/icons/Remix/device/restart-line.react.svg';
import TransactionIcon from '@/components/ui/icons/transaction.react.svg';
import { DEFAULT_DATE_TIME_DISPLAY_FORMAT } from '@/utils/dates';
import TransactionState from '@/components/ui/TransactionState';
import { RuleActionStatus } from '@/components/ui/RuleActionStatus';
import EntityHeader from '@/components/ui/entityPage/EntityHeader';
import { TransactionTypeTag } from '@/components/ui/TransactionTypeTag';
import TransactionEventsCard from '@/pages/transactions-item/TransactionEventsCard';

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
      <Card.Root>
        <AsyncResourceRenderer resource={currentItem}>
          {(transaction) => (
            <>
              <Card.Section direction="horizontal" spacing="double">
                <EntityHeader id={transaction.transactionId} idTitle="Transaction ID">
                  <Form.Layout.Label icon={<TimerLineIcon />} title="Transaction Time">
                    {moment(transaction.timestamp).format(DEFAULT_DATE_TIME_DISPLAY_FORMAT)}
                  </Form.Layout.Label>
                  <Form.Layout.Label icon={<RestartLineIcon />} title="Transaction State">
                    <TransactionState transactionState={transaction.transactionState} />
                  </Form.Layout.Label>
                  <Form.Layout.Label icon={<RestartLineIcon />} title="Transaction Status">
                    <RuleActionStatus ruleAction={transaction.status} />
                  </Form.Layout.Label>
                  <Form.Layout.Label icon={<TransactionIcon />} title="Transaction Type">
                    <TransactionTypeTag transactionType={transaction.type} />
                  </Form.Layout.Label>
                </EntityHeader>
              </Card.Section>
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
