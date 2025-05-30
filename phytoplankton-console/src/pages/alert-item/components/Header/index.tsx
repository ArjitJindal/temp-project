import React from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import StatusChangeMenu from './StatusChangeMenu';
import SubHeader from './SubHeader';
import { Alert, Case, Comment } from '@/apis';
import { useApi } from '@/api';
import EntityHeader from '@/components/ui/entityPage/EntityHeader';
import { ALERT_ITEM, ALERT_LIST, CASES_ITEM } from '@/utils/queries/keys';
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
import {
  AsyncResource,
  getOr,
  isLoading as isAsyncResourceLoading,
  map,
} from '@/utils/asyncResource';
import QaStatusChangeModal from '@/pages/case-management/AlertTable/QaStatusChangeModal';
import { useQaMode } from '@/utils/qa-mode';
import { useBackUrl } from '@/utils/backUrl';
import { TableUser } from '@/pages/case-management/CaseTable/types';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';

interface Props {
  alertItemRes: AsyncResource<Alert>;
  onReload: () => void;
  onCommentAdded: (newComment: Comment, groupId: string) => void;
  headerStickyElRef?: React.RefCallback<HTMLDivElement>;
}

export default function Header(props: Props) {
  const { alertItemRes, headerStickyElRef, onCommentAdded } = props;
  const alertItem = getOr(
    map(alertItemRes, (alertItem) => alertItem),
    undefined,
  );
  const { alertId, caseId } = alertItem ?? {};
  const isLoading = isAsyncResourceLoading(alertItemRes);
  const caseQueryResults = useQuery(
    CASES_ITEM(caseId ?? ''),
    (): Promise<Case> => {
      if (caseId == null) {
        throw new Error(`Alert case id could not be empty`);
      }
      return api.getCase({ caseId });
    },
    {
      enabled: !isLoading,
    },
  );
  const api = useApi();
  const actionsRes = useActions(caseQueryResults.data, alertItemRes, props.onReload);
  return (
    <EntityHeader
      stickyElRef={headerStickyElRef}
      breadcrumbItems={[
        {
          title: 'Cases',
          to: '/case-management/cases',
        },
        map(alertItemRes, (alertItem) => ({
          title: alertItem.caseId ?? 'Unknown case',
          to: alertItem.caseId ? getCaseUrl(alertItem.caseId) : undefined,
        })),
        map(alertItemRes, (alertItem) => ({
          title: 'Alerts',
          to: alertItem.caseId ? getCaseUrl(alertItem.caseId, 'alerts') : undefined,
        })),
        map(alertItemRes, (alertItem) => ({
          title: alertItem.alertId ?? 'Unknown alert',
          to:
            alertItem.caseId && alertItem.alertId
              ? getAlertUrl(alertItem.caseId, alertItem.alertId, true)
              : undefined,
        })),
      ]}
      chips={getOr(
        map(alertItemRes, (alertItem) =>
          [
            <PriorityTag key={`alert-priority-tag`} priority={alertItem.priority} />,
            alertItem.alertStatus && (
              <CaseStatusTag key={`alert-status-tag`} caseStatus={alertItem.alertStatus} />
            ),
          ].filter(notEmpty),
        ),
        [],
      )}
      buttons={[
        <CommentButton
          key={'comment'}
          disabled={isLoading}
          onSuccess={(newComment) => {
            onCommentAdded(newComment, alertId ?? '');
          }}
          submitRequest={async (commentFormValues) => {
            if (alertId == null) {
              throw new Error(`Alert ID is not defined`);
            }
            return await api.createAlertsComment({
              alertId: alertId ?? '',
              CommentRequest: {
                body: sanitizeComment(commentFormValues.comment),
                files: commentFormValues.files,
              },
            });
          }}
          requiredPermissions={['case-management:case-overview:write']}
          requiredResources={['write:::case-management/case-overview/*']}
        />,
        ...getOr(actionsRes, []),
      ]}
      subHeader={<SubHeader caseItemRes={caseQueryResults.data} alertItemRes={alertItemRes} />}
    />
  );
}

function useActions(
  caseItemRes: AsyncResource<Case>,
  alertItemRes: AsyncResource<Alert>,
  onReload: () => void,
): AsyncResource<React.ReactNode[]> {
  const [qaMode] = useQaMode();
  const isSarEnabled = useFeatureEnabled('SAR');
  const client = useQueryClient();
  const backUrl = useBackUrl();
  const queryClient = useQueryClient();

  const navigate = useNavigate();
  const handleSuccessQa = () => {
    queryClient.invalidateQueries({ queryKey: ALERT_LIST() });
    navigate(backUrl ?? '');
  };

  return map(alertItemRes, (alertItem) => {
    const { caseId } = alertItem;
    const result: React.ReactNode[] = [];
    const alertId = alertItem.alertId;

    if (alertId == null) {
      return result;
    }

    // QA-mode buttons
    if (qaMode) {
      if (caseId != null && alertItem.alertStatus === 'CLOSED' && !alertItem.ruleQaStatus) {
        result.push(
          <QaStatusChangeModal
            status={'PASSED'}
            alertIds={[alertId]}
            caseId={caseId}
            onSuccess={handleSuccessQa}
          />,
          <QaStatusChangeModal
            status={'FAILED'}
            alertIds={[alertId]}
            caseId={caseId}
            onSuccess={handleSuccessQa}
          />,
        );
      }
      return result;
    }

    // Comment button
    {
      result.push(
        <AsyncResourceRenderer resource={caseItemRes}>
          {(caseItem) => (
            <AlertsStatusChangeButton
              key={'status-change-button'}
              status={alertItem.alertStatus}
              ids={alertId ? [alertId] : []}
              transactionIds={{}}
              onSaved={() => {
                client.invalidateQueries(ALERT_ITEM(alertId ?? ''));
              }}
              haveModal={true}
              user={
                (caseItem?.caseUsers?.origin as TableUser) ||
                (caseItem?.caseUsers?.destination as TableUser) ||
                undefined
              }
            />
          )}
        </AsyncResourceRenderer>,
      );
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
            onResetSelection={onReload}
          />,
        );
      }
    }
    {
      result.push(
        <StatusChangeMenu
          key={'status-change-menu'}
          alertItem={alertItem}
          isDisabled={false}
          onReload={onReload}
        />,
      );
    }

    return result;
  });
}
