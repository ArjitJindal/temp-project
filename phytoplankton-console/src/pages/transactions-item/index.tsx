import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Tabs as AntTabs } from 'antd';

//components
import SubHeader from './SubHeader';
import SenderReceiverDetails from './SenderReceiverDetails';
import PageWrapper from '@/components/PageWrapper';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import * as Card from '@/components/ui/Card';
import TransactionEventsCard from '@/pages/transactions-item/TransactionEventsCard';

//utils and hooks
import { makeUrl } from '@/utils/routing';
import { AsyncResource, failed, init, isSuccess, loading, success } from '@/utils/asyncResource';
import { ApiException, InternalTransaction } from '@/apis';
import { useApi } from '@/api';
import { useApiTime, usePageViewTracker } from '@/utils/tracker';
import PageTabs from '@/components/ui/PageTabs';
import { keepBackUrl } from '@/utils/backUrl';
import { useElementSize } from '@/utils/browser';
import EntityHeader from '@/components/ui/entityPage/EntityHeader';

export default function TransactionsItem() {
  usePageViewTracker('Transactions Item');
  const [currentItem, setCurrentItem] = useState<AsyncResource<InternalTransaction>>(init());
  const currentTransactionId = isSuccess(currentItem) ? currentItem.value.transactionId : null;
  // const { id: transactionId } = useParams<'id'>();
  const { tab = 'transaction-details' } = useParams<'tab'>();
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
    <AsyncResourceRenderer resource={currentItem}>
      {(transaction) => (
        <PageWrapper
          header={
            <Card.Root>
              <EntityHeader
                stickyElRef={setHeaderStickyElRef}
                breadcrumbItems={[
                  {
                    title: 'Transactions',
                    to: '/transactions',
                  },
                  {
                    title: transaction.transactionId,
                  },
                ]}
                subHeader={<SubHeader transaction={transaction} />}
              />
            </Card.Root>
          }
        >
          <PageTabs
            sticky={entityHeaderHeight}
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
                key: 'transaction-details',
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
        </PageWrapper>
      )}
    </AsyncResourceRenderer>
  );
}
