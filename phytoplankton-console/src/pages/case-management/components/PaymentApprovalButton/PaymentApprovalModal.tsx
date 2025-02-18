import React, { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { humanizeConstant } from '@flagright/lib/utils/humanize';
import Modal from '../../../../components/library/Modal/index';
import { FormRef } from '@/components/library/Form';
import { CaseReasons, RuleAction } from '@/apis';
import { CASE_REASONSS } from '@/apis/models-custom/CaseReasons';
import { useApi } from '@/api';
import { CloseMessage, message } from '@/components/library/Message';
import Narrative, { FormValues, NarrativeFormValues, OTHER_REASON } from '@/components/Narrative';

interface Props {
  visible: boolean;
  transactionIds: string[];
  action: RuleAction;
  hide: () => void;
  onSuccess?: () => void;
}

export default function PaymentApprovalModal({
  visible,
  action,
  transactionIds,
  hide,
  onSuccess,
}: Props) {
  const formRef = useRef<FormRef<FormValues<CaseReasons>>>(null);
  const [narrativeValues, setNarrativeValues] = useState<NarrativeFormValues<CaseReasons>>({
    isValid: false,
    values: { reasons: [], comment: '', files: [], reasonOther: '' },
  });
  const [alwaysShowErrors, setAlwaysShowErrors] = useState(false);
  const api = useApi();

  let messageData: CloseMessage;
  const mutation = useMutation(
    async (values: FormValues<CaseReasons>) => {
      messageData = message.loading(
        `${humanizeConstant(action)} transaction${transactionIds.length > 1 ? 's' : ''}`,
      );

      const res = await api.applyTransactionsAction({
        TransactionAction: {
          transactionIds,
          comment: values.comment || '',
          reason: values.reasons,
          files: values.files?.length > 0 ? values.files : [],
          action,
          otherReason: values.reasonOther || undefined,
        },
      });

      return res;
    },
    {
      onSuccess: () => {
        messageData?.();
        if (action === 'ALLOW') {
          message.success(
            `Transaction(s) were allowed (It might take a few seconds to be visible in Console)`,
          );
        }
        if (action === 'BLOCK') {
          message.success(
            `Transaction(s) were blocked  (It might take a few seconds to be visible in Console)`,
          );
        }
        onSuccess?.();
        hide();
      },
      onError: (e) => {
        messageData?.();
        message.error(`Could not update transaction status: ${e}`);
      },
    },
  );

  return (
    <Modal
      title={`${humanizeConstant(action)} transaction`}
      okText={'Confirm'}
      isOpen={visible}
      onOk={() => {
        setAlwaysShowErrors(true);
        if (narrativeValues.isValid) {
          mutation.mutate(narrativeValues.values);
        }
      }}
      onCancel={hide}
    >
      <Narrative
        values={narrativeValues}
        onSubmit={(values) => {
          mutation.mutate(values);
        }}
        additionalCopilotInfo={{}}
        placeholder={'Write a narrative explaining the reason and findings, if any.'}
        entityType={'TRANSACTION'}
        onChange={setNarrativeValues}
        possibleReasons={CASE_REASONSS}
        showErrors={alwaysShowErrors}
        isCopilotEnabled={true}
        otherReason={OTHER_REASON}
        formRef={formRef}
      />
    </Modal>
  );
}
