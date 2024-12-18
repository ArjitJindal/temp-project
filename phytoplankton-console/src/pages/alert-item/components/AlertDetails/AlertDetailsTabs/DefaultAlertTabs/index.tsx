import React, { useMemo } from 'react';
import Comments from './Comments';
import Checklist from './Checklist';
import TransactionsTab from './TransactionsTab';
import { useQuery } from '@/utils/queries/hooks';
import { ALERT_ITEM } from '@/utils/queries/keys';
import { useApi } from '@/api';
import Tabs, { TabItem } from '@/components/library/Tabs';
import { Alert } from '@/apis';

enum AlertExpandedTabs {
  TRANSACTIONS = 'transactions',
  CHECKLIST = 'checklist',
  COMMENTS = 'comments',
}

interface Props {
  alert: Alert;
  caseUserId: string;
  selectedTransactionIds?: string[];
  onTransactionSelect?: (alertId: string, transactionIds: string[]) => void;
  escalatedTransactionIds?: string[];
}

export default function DefaultAlertTabs(props: Props) {
  const {
    caseUserId,
    selectedTransactionIds,
    alert,
    onTransactionSelect,
    escalatedTransactionIds,
  } = props;
  const alertId = alert.alertId;
  const api = useApi();

  const alertResponse = useQuery(ALERT_ITEM(alertId ?? ''), async () => {
    if (alertId == null) {
      throw new Error(`Unable to fetch alert, id is empty`);
    }
    const alert = await api.getAlert({
      alertId,
    });
    return alert;
  });

  const tabItems = useMemo(() => {
    const tabs: TabItem[] = [];
    tabs.push({
      title: 'Transactions details',
      key: AlertExpandedTabs.TRANSACTIONS,
      children: (
        <TransactionsTab
          alert={alert}
          caseUserId={caseUserId}
          selectedTransactionIds={selectedTransactionIds}
          onTransactionSelect={onTransactionSelect}
          escalatedTransactionIds={escalatedTransactionIds}
        />
      ),
    });
    if (alert.ruleChecklistTemplateId && alert?.alertId) {
      tabs.push({
        title: 'Checklist',
        key: AlertExpandedTabs.CHECKLIST,
        children: <Checklist alert={alert} />,
      });
    }
    tabs.push({
      title: 'Comments',
      key: AlertExpandedTabs.COMMENTS,
      children: <Comments alertId={alertId ?? null} alertsRes={alertResponse.data} />,
    });
    return tabs;
  }, [
    caseUserId,
    alert,
    alertId,
    alertResponse.data,
    escalatedTransactionIds,
    onTransactionSelect,
    selectedTransactionIds,
  ]);

  return <Tabs items={tabItems} type="line" defaultActiveKey={AlertExpandedTabs.TRANSACTIONS} />;
}
