import React, { useMemo, useState } from 'react';
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
import { getOr, isSuccess, map } from '@/utils/asyncResource';
import { InternalTransaction } from '@/apis';
import { useTransactionItem, useTransactionAlerts } from '@/hooks/api';
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
  const { tab = 'transaction-details' } = useParams<'tab'>();
  const { id: transactionId } = useParams<'id'>();
  const navigate = useNavigate();
  const tenantSettings = useSettings();
  const riskClassificationValues = useRiskClassificationScores();

  const queryResult = useTransactionItem(transactionId ?? '');

  const alertsQueryResult = useTransactionAlerts(transactionId ?? '', {
    ...DEFAULT_PARAMS_STATE,
    pageSize: 100,
  });

  const ruleAlertMap: RuleAlertMap = useMemo(() => {
    const alertDetails = new Map<string, { alertId: string; caseId: string }>();

    return getOr(alertsQueryResult.data, {
      data: [],
      total: 0,
    }).data.reduce((alertDetails, alert) => {
      alertDetails.set(alert.alert.ruleInstanceId, {
        alertId: alert.alert.alertId as string,
        caseId: alert.alert.caseId as string,
      });

      return alertDetails;
    }, alertDetails);
  }, [alertsQueryResult.data]);

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
          riskClassificationValues,
        ),
        reportTitle: 'Transaction report',
      });
      message.success('Report downloaded successfully');
    } catch (err) {
      message.fatal('Unable to complete the download!', err);
    } finally {
      setLoading(false);
      hideMessage && hideMessage();
    }
  };

  const [headerStickyElRef, setHeaderStickyElRef] = useState<HTMLDivElement | null>(null);
  const rect = useElementSize(headerStickyElRef);
  const entityHeaderHeight = rect?.height ?? 0;

  const transactionRes = queryResult.data;

  if (transactionId == null) {
    throw new Error('Transaction id is not passed');
  }

  return (
    <PageWrapper
      disableHeaderPadding
      header={
        <Card.Root>
          <EntityHeader
            stickyElRef={setHeaderStickyElRef}
            breadcrumbItems={[
              { title: 'Transactions', to: '/transactions' },
              map(transactionRes, (transaction) => ({ title: transaction.transactionId })),
            ]}
            subHeader={<SubHeader transactionRes={transactionRes} transactionId={transactionId} />}
            buttons={[
              <Button
                type="TETRIARY"
                isDisabled={isLoading || !isSuccess(transactionRes)}
                onClick={async () => {
                  if (isSuccess(transactionRes)) {
                    await handleReportDownload(transactionRes.value, ruleAlertMap);
                  }
                }}
                key="transactions-download-button"
              >
                <DownloadLineIcon height={16} /> Export
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
            keepBackUrl(makeUrl('/transactions/item/:id/:tab', { id: transactionId, tab: newTab })),
            { replace: true },
          );
        }}
        items={[
          {
            title: 'Transaction details',
            key: 'transaction-details',
            children: (
              <div className={s.transactionDetails}>
                <AsyncResourceRenderer resource={transactionRes}>
                  {(transaction) => (
                    <>
                      <SenderReceiverDetails transaction={transaction} />
                      <TransactionTags transaction={transaction} />
                    </>
                  )}
                </AsyncResourceRenderer>
              </div>
            ),
            isClosable: false,
            isDisabled: false,
          },
          {
            title: 'Transaction events',
            key: 'transaction-events',
            children: <TransactionEventsCard transactionId={transactionId} />,
            isClosable: false,
            isDisabled: false,
          },
        ]}
      />
    </PageWrapper>
  );
}
