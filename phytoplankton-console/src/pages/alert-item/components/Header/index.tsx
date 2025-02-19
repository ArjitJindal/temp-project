import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import SubHeader from './SubHeader';
import StatusChangeMenu from './StatusChangeMenu';
import { Alert, Case, Comment } from '@/apis';
import { useApi } from '@/api';
import EntityHeader from '@/components/ui/entityPage/EntityHeader';
import { ALERT_ITEM, CASES_ITEM } from '@/utils/queries/keys';
import { getAlertUrl, getCaseUrl } from '@/utils/routing';
import { useQuery } from '@/utils/queries/hooks';
import CommentButton from '@/components/CommentButton';
import { sanitizeComment } from '@/components/markdown/MarkdownEditor/mention-utlis';
import CaseStatusTag from '@/components/library/Tag/CaseStatusTag';
import { notEmpty } from '@/utils/array';
import PriorityTag from '@/components/library/PriorityTag';
import AlertsStatusChangeButton from '@/pages/case-management/components/AlertsStatusChangeButton';
import { SarButton } from '@/components/Sar';
import CreateCaseConfirmModal from '@/pages/case-management/AlertTable/CreateCaseConfirmModal';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';

interface Props {
  isLoading: boolean;
  alertItem: Alert;
  onReload: () => void;
  onCommentAdded: (newComment: Comment, groupId: string) => void;
  headerStickyElRef?: React.RefCallback<HTMLDivElement>;
}

export default function Header(props: Props) {
  const { isLoading, alertItem, headerStickyElRef, onCommentAdded } = props;
  const { caseId } = alertItem;
  const caseQueryResults = useQuery(CASES_ITEM(caseId ?? ''), (): Promise<Case> => {
    if (caseId == null) {
      throw new Error(`Alert case id could not be empty`);
    }
    return api.getCase({ caseId });
  });
  const api = useApi();
  const client = useQueryClient();
  const actions = useActions(alertItem, caseId);
  return (
    <EntityHeader
      stickyElRef={headerStickyElRef}
      breadcrumbItems={[
        {
          title: 'Cases',
          to: '/case-management/cases',
        },
        {
          title: alertItem.caseId ?? 'Unknown case',
          to: alertItem.caseId ? getCaseUrl(alertItem.caseId) : undefined,
        },
        {
          title: 'Alerts',
          to: alertItem.caseId ? getCaseUrl(alertItem.caseId, 'alerts') : undefined,
        },
        {
          title: alertItem.alertId ?? 'Unknown alert',
          to:
            alertItem.caseId && alertItem.alertId
              ? getAlertUrl(alertItem.caseId, alertItem.alertId, true)
              : undefined,
        },
      ]}
      chips={[
        <PriorityTag key={`alert-priority-tag`} priority={alertItem.priority} />,
        alertItem.alertStatus && (
          <CaseStatusTag key={`alert-status-tag`} caseStatus={alertItem.alertStatus} />
        ),
      ].filter(notEmpty)}
      buttons={[
        <CommentButton
          key={'comment'}
          disabled={isLoading}
          onSuccess={(newComment) => {
            onCommentAdded(newComment, alertItem.alertId ?? '');
          }}
          submitRequest={async (commentFormValues) => {
            if (alertItem.alertId == null) {
              throw new Error(`Alert ID is not defined`);
            }
            return await api.createAlertsComment({
              alertId: alertItem.alertId ?? '',
              CommentRequest: {
                body: sanitizeComment(commentFormValues.comment),
                files: commentFormValues.files,
              },
            });
          }}
          requiredPermissions={['case-management:case-overview:write']}
        />,
        <AlertsStatusChangeButton
          key={'status-change-button'}
          status={alertItem.alertStatus}
          ids={alertItem.alertId ? [alertItem.alertId] : []}
          transactionIds={{}}
          onSaved={() => {
            client.invalidateQueries(ALERT_ITEM(alertItem.alertId ?? ''));
          }}
          haveModal={true}
        />,
        ...actions,
        <StatusChangeMenu
          key={'status-change-menu'}
          alertItem={alertItem}
          isDisabled={isLoading}
          onReload={props.onReload}
        />,
      ]}
      subHeader={<SubHeader caseItemRes={caseQueryResults.data} alertItem={alertItem} />}
    />
  );
}

function useActions(alertItem: Alert, caseId: string | undefined): React.ReactNode[] {
  const isSarEnabled = useFeatureEnabled('SAR');
  const client = useQueryClient();

  const result: React.ReactNode[] = [];
  const alertId = alertItem.alertId;

  if (alertId == null) {
    return result;
  }

  // SAR report button
  {
    if (isSarEnabled && caseId != null) {
      result.push(<SarButton caseId={caseId} alertIds={[alertId]} />);
    }
  }

  // Create new case modal
  {
    if (caseId) {
      result.push(
        <CreateCaseConfirmModal
          selectedEntities={[alertId]}
          caseId={caseId}
          onResetSelection={() => {
            client.invalidateQueries(ALERT_ITEM(alertItem.alertId ?? ''));
          }}
        />,
      );
    }
  }

  return result;
}
