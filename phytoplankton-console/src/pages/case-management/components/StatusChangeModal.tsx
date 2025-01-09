import React, { useEffect, useMemo, useState } from 'react';
import pluralize from 'pluralize';
import { UseMutationResult } from '@tanstack/react-query';
import { statusToOperationName } from './StatusChangeButton';
import s from './index.module.less';
import { CaseStatus, FileInfo, KYCStatusDetailsInternal, UserStateDetailsInternal } from '@/apis';
import Modal from '@/components/library/Modal';
import Checkbox from '@/components/library/Checkbox';
import Narrative, { NarrativeRef } from '@/components/Narrative';
import { useFinishedSuccessfully } from '@/utils/asyncResource';
import { getMutationAsyncResource } from '@/utils/queries/mutations/helpers';
import Label from '@/components/library/Label';
import { useDeepEqualMemo } from '@/utils/hooks';
import { statusEscalated } from '@/utils/case-utils';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import { notEmpty } from '@/components/library/Form/utils/validation/basicValidators';
import { sanitizeComment } from '@/components/markdown/MarkdownEditor/mention-utlis';
import { useUsers } from '@/utils/user-utils';
import MarkdownEditor from '@/components/markdown/MarkdownEditor';
import { useReasons } from '@/utils/reasons';

export interface FormValues {
  reasons: string[];
  reasonOther: string | undefined;
  comment: string | undefined;
  files: FileInfo[];
  closeRelatedCase?: boolean;
  kycStatusDetails?: KYCStatusDetailsInternal;
  userStateDetails?: UserStateDetailsInternal;
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
  displayCloseRelatedCases?: boolean;
  skipReasonsModal?: boolean;
  advancedOptions?: React.ReactNode;
}

const DEFAULT_INITIAL_VALUES: FormValues = {
  reasons: [],
  reasonOther: undefined,
  comment: '',
  files: [],
  closeRelatedCase: false,
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
    displayCloseRelatedCases,
    skipReasonsModal = false,
    advancedOptions,
  } = props;
  const initialValues: FormValues = useDeepEqualMemo(
    () => ({
      ...DEFAULT_INITIAL_VALUES,
      ...props.initialValues,
      defaultReasons,
    }),
    [props.initialValues, defaultReasons],
  );
  const [isAwaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const isReopen = oldStatus === 'CLOSED' && newStatus === 'REOPENED';
  const showConfirmation = isVisible && (isReopen || isAwaitingConfirmation || skipReasonsModal);
  const [showErrors, setAlwaysShowErrors] = useState(false);
  const [closeRelatedCase, setCloseRelatedCase] = useState(false);
  const [users] = useUsers();
  const isMentionsEnabled = useFeatureEnabled('NOTIFICATIONS');

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
  const kycStatusDetailsValidator = {
    reason: formState.values.kycStatusDetails?.status ? notEmpty : undefined,
  };
  const userStateDetailsValidator = {
    reason: formState.values.userStateDetails?.state ? notEmpty : undefined,
  };
  return (
    <>
      <Modal
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
          // otherReason={OTHER_REASON}
          onChange={setFormState}
          alertMessage={alertMessage}
          entityType={entityName}
          extraFields={
            displayCloseRelatedCases &&
            statusEscalated(newStatus) && (
              <Label
                label={`Close related ${entityName === 'ALERT' ? 'cases' : 'alerts'}`}
                position={'RIGHT'}
              >
                <Checkbox
                  onChange={(newValue) => newValue && setCloseRelatedCase(true)}
                  value={closeRelatedCase}
                />
              </Label>
            )
          }
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
            userStateDetails: userStateDetailsValidator,
            kycStatusDetails: kycStatusDetailsValidator,
          }}
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
          const sanitizedComment = formState.values.comment
            ? `Checker Comment: ${sanitizeComment(formState.values.comment)}`
            : '';
          updateMutation.mutate({
            ...formState.values,
            comment: sanitizedComment,
            closeRelatedCase,
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
