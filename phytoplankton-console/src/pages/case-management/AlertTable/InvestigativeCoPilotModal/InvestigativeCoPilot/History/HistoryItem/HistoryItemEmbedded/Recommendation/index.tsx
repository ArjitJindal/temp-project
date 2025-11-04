import { firstLetterUpper } from '@flagright/lib/utils/humanize';
import s from './index.module.less';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { SarButton } from '@/components/Sar';
import { findLastStatusForInReview, statusInReview } from '@/utils/case-utils';
import { ApproveSendBackButton } from '@/pages/case-management/components/ApproveSendBackButton';
import AlertsStatusChangeButton from '@/pages/case-management/components/AlertsStatusChangeButton';
import { useAlertDetails } from '@/utils/api/alerts';
import { useFeatureEnabled, useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { notEmpty } from '@/utils/array';

export const Recommendation = ({ alertId, pdfMode }: { alertId: string; pdfMode?: boolean }) => {
  const settings = useSettings();
  const alertQuery = useAlertDetails(alertId, { enabled: !pdfMode });
  const isEscalationEnabled = useFeatureEnabled('ADVANCED_WORKFLOWS');

  const userAlias = firstLetterUpper(settings.userAlias);
  return (
    <>
      <h3>Significant observations</h3>
      <ul>
        <li>{`${userAlias} has been flagged by high velocity rule 8 times in the last 3 months.`}</li>
        <li>{`${userAlias} has had SARs filed on them twice in the last 6 months.`}</li>
        <li>{`30% of ${settings.userAlias}s transaction amounts end in round numbers. This is higher than average.`}</li>
        <li>{`${userAlias}’s average transaction risk score is 72.8, which is classified as High Risk.`}</li>
        <li>{`${userAlias}’s transaction volume is 164% higher than average.`}</li>
      </ul>
      <h3>Action items</h3>
      <ul>
        <li>{`View past communications with the ${settings.userAlias} in CRM.`}</li>
        <li>{`Investigate linked transactions.`}</li>
      </ul>
      {!pdfMode && (
        <AsyncResourceRenderer resource={alertQuery.data}>
          {(alert) => (
            <div className={s.recommandationActionButtons}>
              {!statusInReview(alert.alertStatus) ? (
                <AlertsStatusChangeButton
                  ids={[alert.alertId].filter(notEmpty)}
                  onSaved={() => {}}
                  transactionIds={{}}
                  caseId={alert.caseId}
                  status={alert.alertStatus}
                  statusTransitions={{
                    OPEN_IN_PROGRESS: { actionLabel: 'Close', status: 'CLOSED' },
                    OPEN_ON_HOLD: { actionLabel: 'Close', status: 'CLOSED' },
                    ESCALATED_IN_PROGRESS: { actionLabel: 'Close', status: 'CLOSED' },
                    ESCALATED_ON_HOLD: { actionLabel: 'Close', status: 'CLOSED' },
                  }}
                  haveModal={true}
                  alertsData={
                    alert.alertId
                      ? [{ alertId: alert.alertId, ruleNature: alert.ruleNature }]
                      : undefined
                  }
                />
              ) : (
                <ApproveSendBackButton
                  ids={[alert.alertId].filter(notEmpty)}
                  onReload={() => {}}
                  previousStatus={findLastStatusForInReview(alert.statusChanges ?? [])}
                  status={alert.alertStatus}
                  type="ALERT"
                  key={alert.alertId}
                  selectedCaseId={alert.caseId}
                />
              )}
              {isEscalationEnabled && !statusInReview(alert.alertStatus) && (
                <AlertsStatusChangeButton
                  ids={[alert.alertId].filter(notEmpty)}
                  transactionIds={{}}
                  onSaved={() => {}}
                  status={alert.alertStatus}
                  caseId={alert.caseId}
                  statusTransitions={{
                    OPEN: { status: 'ESCALATED', actionLabel: 'Escalate' },
                    REOPENED: { status: 'ESCALATED', actionLabel: 'Escalate' },
                    ESCALATED: { status: 'OPEN', actionLabel: 'Send back' },
                    CLOSED: { status: 'ESCALATED', actionLabel: 'Escalate' },
                    OPEN_IN_PROGRESS: { status: 'ESCALATED', actionLabel: 'Escalate' },
                    OPEN_ON_HOLD: { status: 'ESCALATED', actionLabel: 'Escalate' },
                    ESCALATED_IN_PROGRESS: { status: 'OPEN', actionLabel: 'Send back' },
                    ESCALATED_ON_HOLD: { status: 'OPEN', actionLabel: 'Send back' },
                  }}
                  haveModal={true}
                  alertsData={
                    alert.alertId
                      ? [{ alertId: alert.alertId, ruleNature: alert.ruleNature }]
                      : undefined
                  }
                />
              )}
              {alert.caseId && (
                <SarButton
                  alertIds={[alert.alertId].filter(notEmpty)}
                  caseId={alert.caseId}
                  transactionIds={alert?.transactionIds ?? []}
                  source="alert"
                />
              )}
            </div>
          )}
        </AsyncResourceRenderer>
      )}
    </>
  );
};
