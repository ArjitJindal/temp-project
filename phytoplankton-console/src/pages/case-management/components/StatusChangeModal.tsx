import React, { useEffect, useMemo, useState } from 'react';
import pluralize from 'pluralize';
import { UseMutationResult } from '@tanstack/react-query';
import { areArraysOfObjectsEqual } from '@flagright/lib/utils';
import { TableUser } from '../CaseTable/types';
import { statusToOperationName } from './StatusChangeButton';
import s from './index.module.less';
import {
  CaseStatus,
  FileInfo,
  KYCStatus,
  RuleAction,
  ScreeningDetails,
  UserState,
  UserTag,
} from '@/apis';
import Modal from '@/components/library/Modal';
import Narrative, { NarrativeRef, OTHER_REASON } from '@/components/Narrative';
import { useFinishedSuccessfully } from '@/utils/asyncResource';
import { getMutationAsyncResource } from '@/utils/queries/mutations/helpers';
import { useDeepEqualMemo } from '@/utils/hooks';
import { statusEscalated } from '@/utils/case-utils';
import { useFeatureEnabled, useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { sanitizeComment } from '@/components/markdown/MarkdownEditor/mention-utlis';
import { useCurrentUser } from '@/utils/user-utils';
import { useUsers } from '@/utils/api/auth';
import MarkdownEditor from '@/components/markdown/MarkdownEditor';
import { useReasons } from '@/utils/reasons';
import { notEmpty } from '@/components/library/Form/utils/validation/basicValidators';

export interface FormValues {
  reasons: string[];
  reasonOther: string | undefined;
  comment: string | undefined;
  files: FileInfo[];
  closeRelatedCase?: boolean;
  kycStatusDetails?: KYCStatus;
  userStateDetails?: UserState;
  eoddDate?: number;
  tags?: UserTag[];
  screeningDetails?: ScreeningDetails;
  listId?: string;
  actionReason?: string;
  updateTransactionStatus?: RuleAction;
}

export type ActionLabel =
  | 'Send back'
  | 'Escalate'
  | 'Approve'
  | 'Decline'
  | 'Close'
  | 'Escalate L2';

export interface Props {
  entityName: 'CASE' | 'ALERT' | 'TRANSACTION';
  isVisible: boolean;
  entityIds: string[];
  oldStatus?: CaseStatus;
  newStatus: CaseStatus;
  newStatusActionLabel?: ActionLabel;
  defaultReasons?: string[];
  initialValues?: Partial<FormValues>;
  onClose: () => void;
  updateMutation: UseMutationResult<unknown, unknown, FormValues>;
  skipReasonsModal?: boolean;
  advancedOptions?: React.ReactNode;
  user?: TableUser;
}

const DEFAULT_INITIAL_VALUES: FormValues = {
  reasons: [],
  reasonOther: undefined,
  comment: '',
  files: [],
  closeRelatedCase: false,
  tags: [],
};

export default function StatusChangeModal(props: Props) {
  const {
    entityIds,
    entityName,
    oldStatus,
    newStatus,
    isVisible,
    defaultReasons,
    onClose,
    updateMutation,
    newStatusActionLabel,
    skipReasonsModal = false,
    advancedOptions,
  } = props;

  const initialValues: FormValues = useDeepEqualMemo(
    () => ({
      ...DEFAULT_INITIAL_VALUES,
      ...props.initialValues,
      reasons: defaultReasons ?? [],
    }),
    [props.initialValues, defaultReasons],
  );
  const [isAwaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const isReopen = oldStatus === 'CLOSED' && newStatus === 'REOPENED';
  const showConfirmation = isVisible && (isReopen || isAwaitingConfirmation || skipReasonsModal);
  const [showErrors, setAlwaysShowErrors] = useState(false);
  const { users } = useUsers();
  const currentUser = useCurrentUser();
  const isMentionsEnabled = useFeatureEnabled('NOTIFICATIONS');
  const multiLevelEscalation = useFeatureEnabled('MULTI_LEVEL_ESCALATION');

  const updateRes = getMutationAsyncResource(updateMutation);
  const isFinishedSuccessfully = useFinishedSuccessfully(updateRes);

  const narrativeRef = React.useRef<NarrativeRef>(null);

  useEffect(() => {
    if (isFinishedSuccessfully) {
      onClose();
    }
  }, [isFinishedSuccessfully, initialValues, onClose]);

  const modalTitle = useMemo(() => {
    return `${newStatusActionLabel ?? statusToOperationName(newStatus)} ${pluralize(
      entityName.toLowerCase(),
      entityIds.length,
      true,
    )}`;
  }, [newStatusActionLabel, newStatus, entityName, entityIds]);

  const possibleReasons = useReasons(statusEscalated(newStatus) ? 'ESCALATION' : 'CLOSURE');

  const isQAEnabled = useFeatureEnabled('QA');
  const qaText =
    isQAEnabled && newStatus === 'CLOSED'
      ? 'All the checklist items status that are not updated will be marked as Done.'
      : '';

  const alertMessage = useMemo(() => {
    return newStatusActionLabel === 'Send back'
      ? 'Please note that a case/alert will be reassigned to a previous assignee if available or else it will be assigned to the account that escalated the case/alert.'
      : undefined;
  }, [newStatusActionLabel]);

  const [formState, setFormState] = useState<{ values: FormValues; isValid: boolean }>({
    values: initialValues,
    isValid: false,
  });

  // Check if approval workflows require a reason (only if feature is enabled)
  const isUserChangesApprovalEnabled = useFeatureEnabled('USER_CHANGES_APPROVAL');
  const tenantSettings = useSettings();

  const actionReasonValidator = () => {
    // Require reason if KYC/User status details are being changed (existing logic)
    const requiresReasonForStatusChanges =
      formState.values.kycStatusDetails || formState.values.userStateDetails;

    // should reason be mandatory for eodd changes
    const isEoddWorkflowPresent = tenantSettings.workflowSettings?.userApprovalWorkflows?.eoddDate;
    const isEoddChanged = formState.values.eoddDate;
    const requiresReasonForEodd =
      isUserChangesApprovalEnabled && isEoddChanged && isEoddWorkflowPresent;

    // should reason be mandatory for pep changes
    const isPepWorkflowPresent = tenantSettings.workflowSettings?.userApprovalWorkflows?.PepStatus;
    const isPepChanged = !areArraysOfObjectsEqual(
      formState.values.screeningDetails?.pepStatus ?? [],
      initialValues.screeningDetails?.pepStatus ?? [],
    );
    const requiresReasonForPep =
      isUserChangesApprovalEnabled && isPepChanged && isPepWorkflowPresent;

    // Require reason if any field changes need approval workflow (only when feature is enabled)
    if (requiresReasonForStatusChanges || requiresReasonForEodd || requiresReasonForPep) {
      return notEmpty;
    }

    return undefined;
  };

  const isPaymentApprovalEnabled = useSettings().isPaymentApprovalEnabled;

  return (
    <>
      <Modal
        id={'status-change-modal'}
        isResizable={true}
        title={modalTitle}
        isOpen={isVisible && !showConfirmation}
        okProps={{
          isLoading: updateMutation.isLoading,
        }}
        width="M"
        okText="Confirm"
        onOk={() => {
          setAlwaysShowErrors(true);
          if (formState.isValid) {
            setAwaitingConfirmation(true);
          }
        }}
        onCancel={() => {
          onClose();
        }}
      >
        <Narrative
          ref={narrativeRef}
          showErrors={showErrors}
          values={formState}
          otherReason={OTHER_REASON}
          onChange={setFormState}
          alertMessage={alertMessage}
          entityType={entityName}
          entityIds={entityIds || []}
          placeholder={`Write a narrative explaining the ${entityName.toLowerCase()} ${
            statusEscalated(newStatus) ? 'escalation' : 'closure'
          } reason and findings, if any.`}
          possibleReasons={possibleReasons}
          onSubmit={() => {
            setAwaitingConfirmation(true);
          }}
          advancedOptions={advancedOptions}
          advancedOptionsValidators={{
            actionReason: actionReasonValidator(),
          }}
          additionalCopilotInfo={{
            ...(entityName === 'CASE' && { newCaseStatus: newStatus }),
            ...(entityName === 'ALERT' && { newAlertStatus: newStatus }),
          }}
          showPaymentApprovalStatusChange={
            (entityName === 'CASE' || entityName === 'ALERT') &&
            newStatus === 'CLOSED' &&
            isPaymentApprovalEnabled
          }
        />
      </Modal>
      <Modal
        title="ⓘ Confirm action"
        isOpen={showConfirmation}
        okProps={{
          isDisabled: updateMutation.isLoading,
        }}
        okText="Confirm"
        onOk={() => {
          let commentPrefix = '';
          if (currentUser?.reviewerId) {
            commentPrefix = 'Maker Comment:';
          } else if (currentUser?.isReviewer) {
            commentPrefix = 'Checker Comment:';
          } else if (multiLevelEscalation) {
            if (currentUser?.escalationLevel === 'L1') {
              commentPrefix = 'Escalation Reveiwer L1 Comment:';
            } else if (currentUser?.escalationLevel === 'L2') {
              commentPrefix = 'Escalation Reveiwer L2 Comment:';
            }
          }
          if (!commentPrefix) {
            commentPrefix = 'User Comment:';
          }
          const sanitizedComment = formState.values.comment
            ? `${commentPrefix} ${sanitizeComment(formState.values.comment)}`
            : '';
          updateMutation.mutate({
            ...formState.values,
            comment: sanitizedComment,
          });
          narrativeRef?.current?.reset();
        }}
        onCancel={() => {
          setAwaitingConfirmation(false);
          onClose();
        }}
      >
        <div className={s.confirmationModal}>
          <span>
            Are you sure you want to{' '}
            <b>{newStatusActionLabel ?? statusToOperationName(newStatus)}</b>{' '}
            {pluralize(entityName, entityIds.length, true)} <b>{entityIds.join(', ')}</b> ? {qaText}
          </span>
          {(newStatusActionLabel === 'Approve' || newStatusActionLabel === 'Decline') && (
            <div className={s.commentContainer}>
              <b>Comment</b>
              <MarkdownEditor
                initialValue={formState.values.comment || ''}
                mentionsEnabled={isMentionsEnabled}
                mentionsList={Object.keys(users).map((userId) => ({
                  label: users[userId].email,
                  id: users[userId].id,
                }))}
                onChange={(v) =>
                  setFormState((prev) => ({
                    ...prev,
                    values: { ...prev.values, comment: v },
                  }))
                }
              />
            </div>
          )}
        </div>
      </Modal>
    </>
  );
}
