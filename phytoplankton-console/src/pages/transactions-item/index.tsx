import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Tabs as AntTabs } from 'antd';

//components
import SubHeader from './SubHeader';
import SenderReceiverDetails from './SenderReceiverDetails';
import PageWrapper from '@/components/PageWrapper';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import * as Card from '@/components/ui/Card';
import * as Form from '@/components/ui/Form';
import TransactionState from '@/components/ui/TransactionStateTag';
import { RuleActionStatus } from '@/components/ui/RuleActionStatus';
import EntityHeader from '@/components/ui/entityPage/EntityHeader';
import { TransactionTypeTag } from '@/components/ui/TransactionTypeTag';
import TransactionEventsCard from '@/pages/transactions-item/TransactionEventsCard';

//utils and hooks
import { dayjs, DEFAULT_DATE_TIME_FORMAT } from '@/utils/dayjs';
import { makeUrl } from '@/utils/routing';
import { useI18n } from '@/locales';
import { AsyncResource, failed, init, isSuccess, loading, success } from '@/utils/asyncResource';
import { ApiException, InternalTransaction } from '@/apis';
import { useApi } from '@/api';
import { useApiTime, usePageViewTracker } from '@/utils/tracker';
import PageTabs from '@/components/ui/PageTabs';
import { HEADER_HEIGHT } from '@/components/AppWrapper/Header';
import { keepBackUrl } from '@/utils/backUrl';
import { useElementSize } from '@/utils/browser';

export default function TransactionsItem() {
  usePageViewTracker('Transactions Item');
  const i18n = useI18n();
  const [currentItem, setCurrentItem] = useState<AsyncResource<InternalTransaction>>(init());
  const currentTransactionId = isSuccess(currentItem) ? currentItem.value.transactionId : null;
  // const { id: transactionId } = useParams<'id'>();
  const { tab = 'user-details' } = useParams<'tab'>();
  const { id: transactionId } = useParams<'id'>();
  const api = useApi();
  const measure = useApiTime();
  const navigate = useNavigate();

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

  const [headerStickyElRef, setHeaderStickyElRef] = useState<HTMLDivElement | null>(null);
  const rect = useElementSize(headerStickyElRef);
  const entityHeaderHeight = rect?.height ?? 0;

  return (
    <PageWrapper
      backButton={{
        title: i18n('menu.transactions.transactions-list.item.back-button'),
        url: makeUrl('/transactions/list'),
      }}
    >
      <AsyncResourceRenderer resource={currentItem}>
        {(transaction) => (
          <>
            <Card.Root>
              <EntityHeader
                stickyElRef={setHeaderStickyElRef}
                id={transaction.transactionId}
                idTitle="Transaction ID"
                subHeader={<SubHeader transaction={transaction} />}
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
                <Form.Layout.Label title="Product Type">
                  {transaction.productType ?? '-'}
                </Form.Layout.Label>
                <Form.Layout.Label title="Reference">
                  {transaction.reference ?? '-'}
                </Form.Layout.Label>
              </EntityHeader>
            </Card.Root>
            <>
              <PageTabs
                sticky={HEADER_HEIGHT + entityHeaderHeight}
                activeKey={tab}
                onTabClick={(newTab) => {
                  navigate(
                    keepBackUrl(
                      makeUrl('/transactions/item/:id/:tab', { id: transactionId, tab: newTab }),
                    ),
                    {
                      replace: true,
                    },
                  );
                }}
              >
                {[
                  {
                    tab: 'Transaction Details',
                    key: 'user-details',
                    children: <SenderReceiverDetails transaction={transaction} />,
                    isClosable: false,
                    isDisabled: false,
                  },
                  {
                    tab: 'Transaction Events',
                    key: 'transaction-events',
                    children: <TransactionEventsCard events={transaction.events ?? []} />,
                    isClosable: false,
                    isDisabled: false,
                  },
                ].map(({ tab, key, isDisabled, isClosable, children }) => (
                  <AntTabs.TabPane
                    key={key}
                    tab={tab}
                    closable={isClosable}
                    disabled={isDisabled ?? false}
                  >
                    <div>{children}</div>
                  </AntTabs.TabPane>
                ))}
              </PageTabs>
            </>
          </>
        )}
      </AsyncResourceRenderer>
    </PageWrapper>
  );
}
