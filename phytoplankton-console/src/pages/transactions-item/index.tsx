import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';

//components
import SubHeader from './SubHeader';
import SenderReceiverDetails from './SenderReceiverDetails';
import { getTransactionReportTables } from './TransactionReport';
import s from './index.module.less';
import PageWrapper from '@/components/PageWrapper';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import * as Card from '@/components/ui/Card';
import TransactionEventsCard from '@/pages/transactions-item/TransactionEventsCard';
import Button from '@/components/library/Button';

//utils and hooks
import { makeUrl } from '@/utils/routing';
import {
  AsyncResource,
  failed,
  getOr,
  init,
  isSuccess,
  loading,
  success,
} from '@/utils/asyncResource';
import { Alert, AlertListResponseItem, ApiException, InternalTransaction } from '@/apis';
import { useApi } from '@/api';
import PageTabs from '@/components/ui/PageTabs';
import { keepBackUrl } from '@/utils/backUrl';
import { useElementSize } from '@/utils/browser';
import EntityHeader from '@/components/ui/entityPage/EntityHeader';
import DownloadLineIcon from '@/components/ui/icons/Remix/system/download-line.react.svg';
import DownloadAsPDF from '@/components/DownloadAsPdf/DownloadAsPDF';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { message } from '@/components/library/Message';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { useRiskClassificationScores } from '@/utils/risk-levels';
import TransactionTags from '@/pages/transactions-item/TransactionTags';

export type RuleAlertMap = Map<string, { alertId: string; caseId: string }>;

export default function TransactionsItem() {
  const [currentItem, setCurrentItem] = useState<AsyncResource<InternalTransaction>>(init());
  const currentTransactionId = isSuccess(currentItem) ? currentItem.value.transactionId : null;
  // const { id: transactionId } = useParams<'id'>();
  const { tab = 'transaction-details' } = useParams<'tab'>();
  const { id: transactionId } = useParams<'id'>();
  const api = useApi();
  const navigate = useNavigate();
  const tenantSettings = useSettings();
  const riskClassificationValues = useRiskClassificationScores();

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

  const [transactionAlertsQueryResult, setTransactionAlertQueryResult] = useState<Alert[] | null>(
    null,
  );

  useEffect(() => {
    if (currentTransactionId) {
      api
        .getAlertList({
          ...DEFAULT_PARAMS_STATE,
          pageSize: 100,
          filterTransactionIds: [currentTransactionId],
        })
        .then((res) => {
          setTransactionAlertQueryResult(res.data.map((item: AlertListResponseItem) => item.alert));
        });
    }
  }, [currentTransactionId, api]);

  const ruleAlertMap: RuleAlertMap = useMemo(() => {
    const alertDetails = new Map<string, { alertId: string; caseId: string }>();

    return (transactionAlertsQueryResult ?? []).reduce((alertDetails, alert) => {
      alertDetails.set(alert.ruleInstanceId, {
        alertId: alert.alertId as string,
        caseId: alert.caseId as string,
      });

      return alertDetails;
    }, alertDetails);
  }, [transactionAlertsQueryResult]);

  const [isLoading, setLoading] = useState(false);

  const handleReportDownload = async (transaction: InternalTransaction, ruleAlertMap) => {
    const hideMessage = message.loading('Downloading report...');
    setLoading(true);

    try {
      await DownloadAsPDF({
        fileName: `transaction-${transaction.transactionId}-report.pdf`,
        tableOptions: getTransactionReportTables(
          transaction,
          ruleAlertMap,
          tenantSettings,
          getOr(riskClassificationValues, []),
        ),
        reportTitle: 'Transaction report',
      });
    } catch (err) {
      message.fatal('Unable to complete the download!', err);
    } finally {
      setLoading(false);
      hideMessage && hideMessage();
      message.success('Report successfully downloaded');
    }
  };

  const [headerStickyElRef, setHeaderStickyElRef] = useState<HTMLDivElement | null>(null);
  const rect = useElementSize(headerStickyElRef);
  const entityHeaderHeight = rect?.height ?? 0;

  return (
    <AsyncResourceRenderer resource={currentItem}>
      {(transaction) => (
        <PageWrapper
          disableHeaderPadding
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
                buttons={[
                  <Button
                    type="TETRIARY"
                    isDisabled={isLoading}
                    onClick={async () => {
                      await handleReportDownload(transaction, ruleAlertMap);
                    }}
                  >
                    <DownloadLineIcon height={16} /> Download report
                  </Button>,
                ]}
              />
            </Card.Root>
          }
        >
          <PageTabs
            sticky={entityHeaderHeight}
            activeKey={tab}
            onChange={(newTab) => {
              navigate(
                keepBackUrl(
                  makeUrl('/transactions/item/:id/:tab', { id: transactionId, tab: newTab }),
                ),
                {
                  replace: true,
                },
              );
            }}
            items={[
              {
                title: 'Transaction details',
                key: 'transaction-details',
                children: (
                  <div className={s.transactionDetails}>
                    <SenderReceiverDetails transaction={transaction} />
                    <TransactionTags transaction={transaction} />
                  </div>
                ),
                isClosable: false,
                isDisabled: false,
              },
              {
                title: 'Transaction events',
                key: 'transaction-events',
                children: <TransactionEventsCard events={transaction.events ?? []} />,
                isClosable: false,
                isDisabled: false,
              },
            ]}
          />
        </PageWrapper>
      )}
    </AsyncResourceRenderer>
  );
}
