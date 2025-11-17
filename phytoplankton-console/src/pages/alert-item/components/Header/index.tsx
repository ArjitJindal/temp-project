import React, { useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { EllipsisOutlined } from '@ant-design/icons';
import { AlertStatusWithDropDown } from '../AlertStatusWithDropDown';
import AiForensicsPdfDownloadButton from './AiForensicsPdfDownloadButton';
import SubHeader from './SubHeader';
import s from './index.module.less';
import Dropdown from '@/components/library/Dropdown';
import { Alert, Case, Comment } from '@/apis';
import { useApi } from '@/api';
import EntityHeader from '@/components/ui/entityPage/EntityHeader';
import { ALERT_LIST } from '@/utils/queries/keys';
import { getAlertUrl, getCaseUrl } from '@/utils/routing';
import CommentButton from '@/components/CommentButton';
import { sanitizeComment } from '@/components/markdown/MarkdownEditor/mention-utlis';
import { notEmpty } from '@/utils/array';
import PriorityTag from '@/components/library/PriorityTag';
import AlertsStatusChangeButton from '@/pages/case-management/components/AlertsStatusChangeButton';
import Skeleton from '@/components/library/Skeleton';
import { SarButton } from '@/components/Sar';
import CreateCaseConfirmModal from '@/pages/case-management/AlertTable/CreateCaseConfirmModal';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import {
  AsyncResource,
  getOr,
  isLoading as isAsyncResourceLoading,
  map,
} from '@/utils/asyncResource';
import {
  canMutateEscalatedCases,
  findLastStatusForInReview,
  isEscalatedCases,
  isEscalatedL2Cases,
  isInReviewCases,
} from '@/utils/case-utils';
import { useAuth0User } from '@/utils/user-utils';
import QaStatusChangeModal from '@/pages/case-management/AlertTable/QaStatusChangeModal';
import { useQaMode } from '@/utils/qa-mode';
import { useBackUrl } from '@/utils/backUrl';
import { TableUser } from '@/pages/case-management/CaseTable/types';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import { useAlertDetails, useAlertStatusChangeMutation } from '@/utils/api/alerts';
import { useCaseDetails } from '@/utils/api/cases';

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
  const caseQueryResults = useCaseDetails(caseId ?? undefined, { enabled: !isLoading });
  const api = useApi();
  const isAiForensicsEnabled = useFeatureEnabled('AI_FORENSICS');
  const escalationEnabled = useFeatureEnabled('ADVANCED_WORKFLOWS');
  const isMultiLevelEscalationEnabled = useFeatureEnabled('MULTI_LEVEL_ESCALATION');
  const user = useAuth0User();
  const actionsRes = useActions(caseQueryResults.data, alertItemRes, props.onReload);
  const aiForensicsRef = useRef<HTMLDivElement>(null);
  const statusChangeRef = useRef<HTMLDivElement>(null);
  const previousStatus = useMemo(() => {
    return findLastStatusForInReview(alertItem?.statusChanges ?? []);
  }, [alertItem?.statusChanges]);

  const statusChangeMutation = useAlertStatusChangeMutation(alertId, {
    onReload: props.onReload,
  });

  const escalationOptions = buildEscalationOptions(
    alertItem,
    escalationEnabled,
    isMultiLevelEscalationEnabled,
    user.userId,
    props.onReload,
  );
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
              ? getAlertUrl(alertItem.caseId, alertItem.alertId)
              : undefined,
        })),
      ]}
      chips={getOr(
        map(alertItemRes, (alertItem) =>
          [
            <PriorityTag key={`alert-priority-tag`} priority={alertItem.priority} />,
            alertItem.alertStatus && (
              <AlertStatusWithDropDown
                key={`alert-status-drop-down-${alertItem.alertId}`}
                alertStatus={alertItem.alertStatus}
                statusChanges={alertItem.statusChanges ?? []}
                previousStatus={previousStatus}
                assignments={alertItem.assignments ?? []}
                onSelect={(newStatus) => {
                  statusChangeMutation.mutate(newStatus);
                }}
                reviewAssignments={alertItem.reviewAssignments ?? []}
              />
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
          requiredResources={['write:::case-management/case-overview/*']}
        />,
        ...getOr(actionsRes, []),
        alertId && (
          <div key="hamburger-menu" className={s.hamburgerMenu}>
            <Dropdown
              options={[
                ...(isAiForensicsEnabled
                  ? [
                      {
                        value: 'ai-forensics-report',
                        label: <div className={s.leftLabel}>AIF Report</div>,
                      },
                    ]
                  : []),
                ...escalationOptions,
              ]}
              onSelect={(option) => {
                if (option.value === 'ai-forensics-report') {
                  const button = aiForensicsRef.current?.querySelector('button');
                  if (button) {
                    button.click();
                  }
                } else if (option.value === 'escalate' || option.value === 'escalate-l2') {
                  const button = statusChangeRef.current?.querySelector('button');
                  if (button) {
                    button.click();
                  }
                }
              }}
            >
              <EllipsisOutlined className={s.hamburgerIcon} />
            </Dropdown>
            <div ref={aiForensicsRef} className={s.hiddenButton}>
              <AiForensicsPdfDownloadButton alertId={alertId} />
            </div>
            <div ref={statusChangeRef} className={s.hiddenButton}>
              <AsyncResourceRenderer resource={caseQueryResults.data}>
                {(caseItem) => (
                  <AlertsStatusChangeButton
                    status={alertItem?.alertStatus}
                    ids={alertId ? [alertId] : []}
                    transactionIds={{}}
                    onSaved={props.onReload}
                    haveModal={true}
                    user={
                      (caseItem?.caseUsers?.origin as TableUser) ||
                      (caseItem?.caseUsers?.destination as TableUser) ||
                      undefined
                    }
                    alertsData={
                      alertId && alertItem?.ruleNature
                        ? [{ alertId, ruleNature: alertItem.ruleNature }]
                        : undefined
                    }
                  />
                )}
              </AsyncResourceRenderer>
            </div>
          </div>
        ),
      ].filter(notEmpty)}
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
  const backUrl = useBackUrl();
  const queryClient = useQueryClient();
  const alertDetails = useAlertDetails(getOr(alertItemRes, undefined)?.alertId);

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
        <Skeleton res={caseItemRes} length={10}>
          {(caseItem) => (
            <AlertsStatusChangeButton
              key={'status-change-button'}
              status={alertItem.alertStatus}
              ids={alertId ? [alertId] : []}
              transactionIds={{}}
              onSaved={() => {
                alertDetails.refetch();
              }}
              haveModal={true}
              user={
                (caseItem?.caseUsers?.origin as TableUser) ||
                (caseItem?.caseUsers?.destination as TableUser) ||
                undefined
              }
              alertsData={
                alertId && alertItem?.ruleNature
                  ? [{ alertId, ruleNature: alertItem.ruleNature }]
                  : undefined
              }
            />
          )}
        </Skeleton>,
      );
    }

    // SAR report button
    {
      if (isSarEnabled && caseId != null) {
        result.push(<SarButton caseId={caseId} alertIds={[alertId]} source="alert" />);
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

    return result;
  });
}

function buildEscalationOptions(
  alertItem: Alert | undefined,
  escalationEnabled: boolean,
  isMultiLevelEscalationEnabled: boolean,
  userId: string,
  _onReload: () => void,
) {
  if (!alertItem || !alertItem.caseId || !alertItem.alertId) {
    return [];
  }

  const { alertId, alertStatus, caseId } = alertItem;
  const isAlertEscalated = isEscalatedCases({ [alertId]: alertItem }, true);
  const isAlertEscalatedL2 = isEscalatedL2Cases({ [alertId]: alertItem }, true);
  const isAlertInReview = isInReviewCases({ [alertId]: alertItem }, true);

  const canEscalate = canMutateEscalatedCases(
    { [caseId]: alertItem },
    userId,
    isMultiLevelEscalationEnabled,
  );

  const result: Array<{ value: string; label: React.ReactNode }> = [];

  if (escalationEnabled && canEscalate && alertStatus && !isAlertInReview) {
    if (!isAlertEscalated && !isAlertEscalatedL2) {
      // Basic escalation
      result.push({
        value: 'escalate',
        label: <div className={s.leftLabel}>Escalate</div>,
      });
    } else if (isMultiLevelEscalationEnabled && isAlertEscalated && !isAlertEscalatedL2) {
      // L2 escalation
      result.push({
        value: 'escalate-l2',
        label: <div className={s.leftLabel}>Escalate L2</div>,
      });
    }
  }

  return result;
}
