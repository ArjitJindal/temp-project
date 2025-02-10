import React from 'react';
import s from './index.module.less';
import { usePreloadedHistory } from './helpers';
import { Alert } from '@/apis';
import InvestigativeCoPilot from '@/pages/case-management/AlertTable/InvestigativeCoPilotModal/InvestigativeCoPilot';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';

interface Props {
  alert: Alert;
  caseUserId: string;
}

export default function AiForensicsTab(props: Props) {
  const { alert, caseUserId } = props;
  const clickhouseEnabled = useFeatureEnabled('CLICKHOUSE_ENABLED');

  const preloadedHistory = usePreloadedHistory(alert, caseUserId);

  return (
    <div className={s.root}>
      {alert.alertId && clickhouseEnabled && (
        <InvestigativeCoPilot alertId={alert.alertId} preloadedHistory={preloadedHistory} />
      )}
    </div>
  );
}
