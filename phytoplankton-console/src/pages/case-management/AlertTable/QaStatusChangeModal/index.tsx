import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import pluralize from 'pluralize';
import Button from '@/components/library/Button';
import { Alert, CaseReasons, ChecklistStatus } from '@/apis';
import Modal from '@/components/library/Modal';
import Narrative, { CLOSING_REASONS, FormValues, OTHER_REASON } from '@/components/Narrative';
import { message } from '@/components/library/Message';
import { useApi } from '@/api';

interface ConfirmModalProps {
  status: ChecklistStatus;
  alertIds: string[];
  caseId: string;
  onResetSelection: () => void;
  onSave: () => void;
  alerts: Alert[];
}

export default function QaStatusChangeModal(props: ConfirmModalProps) {
  const { status, alertIds, onSave, alerts } = props;
  const displayStatus = status === 'PASSED' ? 'pass' : 'fail';
  const [isOpen, setIsOpen] = useState(false);
  const api = useApi();

  const [formState, setFormState] = useState<{ values: FormValues<CaseReasons>; isValid: boolean }>(
    {
      values: {
        reasons: [],
        comment: '',
        files: [],
        reasonOther: '',
      },
      isValid: false,
    },
  );
  const [showError, setShowError] = useState(false);
  const alertsText = pluralize('Alert', alertIds.length);
  const mutation = useMutation(
    async (values: FormValues<CaseReasons>) => {
      await api.alertsQaStatusChange({
        AlertQaStatusUpdateRequest: {
          alertIds,
          checklistStatus: status,
          reason: values.reasons,
          comment: values.comment,
          files: values.files,
        },
      });
    },
    {
      onSuccess: () => {
        if (status === 'FAILED') {
          message.success(`${alertsText} reopened and reassigned successfully`);
        } else {
          message.success(`${alertsText} marked as QA Pass successfully`);
        }
        onSave();
        setIsOpen(false);
      },
      onError: (error) => {
        message.error(`Error marking ${alerts} as QA ${status}: ${(error as Error).message}`);
      },
    },
  );

  const onSubmit = () => {
    setShowError(true);
    if (formState.isValid) {
      mutation.mutate(formState.values);
    }
  };

  const onQAStatusChangeClick = () => {
    const isAllQAChecked = alerts.every((alert) =>
      alert?.ruleChecklist?.every((item) => item.status != null),
    );

    if (isAllQAChecked) {
      setIsOpen(true);
    } else {
      message.error('Please complete all QA checks before marking the QA status');
    }
  };

  return (
    <>
      <Button type="SECONDARY" onClick={() => onQAStatusChangeClick()}>
        QA {displayStatus}
      </Button>
      <Modal
        title={`QA ${displayStatus}`}
        isOpen={isOpen}
        onCancel={() => setIsOpen(false)}
        onOk={onSubmit}
      >
        <Narrative
          values={formState}
          onChange={setFormState}
          entityIds={alertIds}
          entityType={'ALERT'}
          placeholder={'Enter your additional comments here, if any.'}
          possibleReasons={[...CLOSING_REASONS, OTHER_REASON]}
          onSubmit={onSubmit}
          showErrors={showError}
        />
      </Modal>
    </>
  );
}
