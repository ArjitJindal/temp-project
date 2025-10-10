import React from 'react';
import s from './index.module.less';
import { usePreloadedHistory } from './helpers';
import { Alert } from '@/apis';
import InvestigativeCoPilot from '@/pages/case-management/AlertTable/InvestigativeCoPilotModal/InvestigativeCoPilot';
import { Feature } from '@/components/AppWrapper/Providers/SettingsProvider';

interface Props {
  alert: Alert;
  caseUserId: string;
}

export default function AiForensicsTab(props: Props) {
  const { alert, caseUserId } = props;

  const preloadedHistory = usePreloadedHistory(alert, caseUserId);

  return (
    <div className={s.root}>
      {alert.alertId && (
        <Feature name={'CLICKHOUSE_ENABLED'} showError={true}>
          <InvestigativeCoPilot alertId={alert.alertId} preloadedHistory={preloadedHistory} />
        </Feature>
      )}
    </div>
  );
}
