import React, { useEffect, useState } from 'react';
import pluralize from 'pluralize';
import { UseMutationResult } from '@tanstack/react-query';
import { statusToOperationName } from './StatusChangeButton';
import { CaseStatus, FileInfo } from '@/apis';
import { CaseReasons } from '@/apis/models/CaseReasons';
import Modal from '@/components/library/Modal';
import Checkbox from '@/components/library/Checkbox';
import Narrative, { CLOSING_REASONS, COMMON_REASONS } from '@/components/Narrative';
import { useFinishedSuccessfully } from '@/utils/asyncResource';
import { getMutationAsyncResource } from '@/utils/queries/hooks';
import Label from '@/components/library/Label';
import { useDeepEqualMemo } from '@/utils/hooks';

export const ESCALATION_REASONS: CaseReasons[] = [
  'Fraud',
  'Anti-money laundering',
  'Terrorist financing',
];

export interface FormValues {
  reasons: CaseReasons[];
  reasonOther: string | undefined;
  comment: string | undefined;
  files: FileInfo[];
  closeRelatedCase?: boolean;
}

export interface Props {
  entityName: 'CASE' | 'ALERT' | 'TRANSACTION';
  isVisible: boolean;
  entityIds: string[];
  oldStatus?: CaseStatus;
  newStatus: CaseStatus;
  newStatusActionLabel?: 'Send back' | 'Escalate' | 'Approve' | 'Decline' | 'Close';
  defaultReasons?: CaseReasons[];
  initialValues?: Partial<FormValues>;
  onSaved: () => void;
  onClose: () => void;
  updateMutation: UseMutationResult<unknown, unknown, FormValues>;
  displayCloseRelatedCases?: boolean;
  skipReasonsModal?: boolean;
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
    onSaved,
    onClose,
    updateMutation,
    newStatusActionLabel,
    displayCloseRelatedCases,
    skipReasonsModal = false,
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

  const updateRes = getMutationAsyncResource(updateMutation);
  const isFinishedSuccessfully = useFinishedSuccessfully(updateRes);
  useEffect(() => {
    if (isFinishedSuccessfully) {
      onClose();
      onSaved();
    }
  }, [isFinishedSuccessfully, initialValues, onSaved, onClose]);

  const possibleReasons: CaseReasons[] = [
    ...(newStatus === 'ESCALATED' ? ESCALATION_REASONS : CLOSING_REASONS),
    ...COMMON_REASONS,
  ];
  const modalTitle = `${newStatusActionLabel ?? statusToOperationName(newStatus)} ${pluralize(
    entityName,
    entityIds.length,
    true,
  )}`;

  const alertMessage =
    newStatusActionLabel === 'Send back'
      ? 'Please note that a case/alert will be reassigned to a previous assignee if available or else it will be assigned to the account that escalated the case/alert.'
      : undefined;
  const [formState, setFormState] = useState<{ values: FormValues; isValid: boolean }>({
    values: initialValues,
    isValid: false,
  });

  return (
    <>
      <Modal
        title={modalTitle}
        isOpen={isVisible && !showConfirmation}
        okProps={{
          isLoading: updateMutation.isLoading,
        }}
        width="S"
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
          showErrors={showErrors}
          values={formState}
          onChange={setFormState}
          alertMessage={alertMessage}
          extraFields={
            displayCloseRelatedCases &&
            newStatus === 'ESCALATED' && (
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
          placeholder={`Write a narrative explaining the ${entityName} closure reason and findings, if any.`}
          possibleReasons={possibleReasons}
          onSubmit={() => {
            setAwaitingConfirmation(true);
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
          updateMutation.mutate({ ...formState.values, closeRelatedCase });
        }}
        onCancel={() => {
          setAwaitingConfirmation(false);
          onClose();
        }}
      >
        Are you sure you want to <b>{newStatusActionLabel ?? statusToOperationName(newStatus)}</b>{' '}
        {pluralize(entityName, entityIds.length, true)} <b>{entityIds.join(', ')}</b> ?
      </Modal>
    </>
  );
}
