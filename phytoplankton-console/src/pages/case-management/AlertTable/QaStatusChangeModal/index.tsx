import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import pluralize from 'pluralize';
import Button from '@/components/library/Button';
import { CaseReasons, ChecklistStatus } from '@/apis';
import Modal from '@/components/library/Modal';
import Narrative, { FormValues, OTHER_REASON } from '@/components/Narrative';
import { message } from '@/components/library/Message';
import { useApi } from '@/api';
import { sanitizeComment } from '@/components/markdown/MarkdownEditor/mention-utlis';

interface ConfirmModalProps {
  status: ChecklistStatus;
  alertIds: string[];
  caseId: string;
  onResetSelection: () => void;
  reload: () => void;
}

export default function QaStatusChangeModal(props: ConfirmModalProps) {
  const { status, alertIds, reload } = props;
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
        reload();
        setIsOpen(false);
      },
      onError: (error) => {
        message.error(`Error marking ${alertsText} as QA ${status}: ${(error as Error).message}`);
      },
    },
  );

  const onSubmit = () => {
    setShowError(true);
    if (formState.isValid) {
      const sanitizedComment = formState.values.comment
        ? sanitizeComment(formState.values.comment)
        : '';
      mutation.mutate({ ...formState.values, comment: sanitizedComment });
    }
  };

  const onQAStatusChangeClick = async () => {
    const loading = message.loading('Validating QA status...');
    const alerts = await api.alertsValidateQaStatuses({
      ValidateAlertsQAStatusRequest: {
        alertIds,
      },
    });
    const isAllQAChecked = alerts.valid;
    loading();
    if (isAllQAChecked) {
      setIsOpen(true);
    } else {
      message.error('Please complete all QA checks before marking the QA status');
    }
  };

  return (
    <>
      <Button
        type="SECONDARY"
        onClick={onQAStatusChangeClick}
        requiredPermissions={['case-management:qa:write']}
      >
        QA {displayStatus}
      </Button>
      <Modal
        title={`QA ${displayStatus}`}
        isOpen={isOpen}
        onCancel={() => setIsOpen(false)}
        onOk={onSubmit}
        writePermissions={['case-management:qa:write']}
      >
        <Narrative
          values={formState}
          onChange={setFormState}
          entityIds={alertIds}
          entityType={'ALERT'}
          placeholder={'Enter your additional comments here, if any.'}
          possibleReasons={[OTHER_REASON]}
          onSubmit={onSubmit}
          showErrors={showError}
          otherReason={OTHER_REASON}
          isCopilotEnabled={false}
          infoText="Note that the QA status of this alert is updated across all samples that contain this alert. "
        />
      </Modal>
    </>
  );
}
