import React, { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { humanizeConstant } from '@flagright/lib/utils/humanize';
import Modal from '../../../../components/library/Modal/index';
import { FormRef } from '@/components/library/Form';
import { RuleAction } from '@/apis';
import { useApi } from '@/api';
import { CloseMessage, message } from '@/components/library/Message';
import Narrative, { FormValues, NarrativeFormValues, OTHER_REASON } from '@/components/Narrative';
import { sanitizeComment } from '@/components/markdown/MarkdownEditor/mention-utlis';
import { useActionReasons } from '@/hooks/api/settings';
import { getOr } from '@/utils/asyncResource';

interface Props {
  visible: boolean;
  transactionIds: string[];
  action: RuleAction;
  hide: () => void;
  onSuccess?: () => void;
}
interface CommentFormatProps {
  comment: string;
  reason: string[];
  transactionId: string;
  action: RuleAction;
  reasonOther?: string;
}

const commentFormat = (props: CommentFormatProps) => {
  const { comment, reason, transactionId, action, reasonOther } = props;
  const otherIndex = reason.indexOf('Other');
  if (otherIndex !== -1 && reasonOther) {
    reason[otherIndex] = `Other: ${reasonOther}`;
  }
  return `A payment with Transaction ID: **${transactionId}** is ${
    action === 'ALLOW' ? 'allowed' : 'blocked'
  } due to following reasons: ${reason.join(', ')}.\n**Comments** - ${comment}`;
};

export default function PaymentApprovalModal(props: Props) {
  const { visible, action, transactionIds, hide, onSuccess } = props;
  const formRef = useRef<FormRef<FormValues<string>>>(null);
  const reasonsResult = useActionReasons('CLOSURE');
  const reasons = getOr(reasonsResult.data, []).map((reason: any) => reason.reason);
  const [narrativeValues, setNarrativeValues] = useState<NarrativeFormValues<string>>({
    isValid: false,
    values: { reasons: [], comment: '', files: [], reasonOther: '' },
  });
  const [alwaysShowErrors, setAlwaysShowErrors] = useState(false);
  const api = useApi();

  let messageData: CloseMessage;
  const mutation = useMutation(
    async (values: FormValues<string>) => {
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

      const transactionsData = await Promise.all(
        transactionIds.map(async (transactionId) => {
          const transaction = await api.getTransaction({ transactionId });
          return transaction;
        }),
      );

      const commentPromises = transactionsData.flatMap((transaction) => {
        const alertIds = transaction.alertIds ?? [];
        return alertIds.map((alertId) =>
          api.createAlertsComment({
            alertId,
            CommentRequest: {
              body: commentFormat({
                comment: sanitizeComment(values.comment ?? ''),
                reason: values.reasons ?? [],
                transactionId: transaction.transactionId,
                action,
                reasonOther: values.reasonOther,
              }),
              files: values.files?.length > 0 ? values.files : [],
            },
          }),
        );
      });

      await Promise.all(commentPromises);
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
      okProps={{
        isLoading: mutation.isLoading,
      }}
      cancelProps={{
        isLoading: mutation.isLoading,
      }}
      onCancel={hide}
      maskClosable={!mutation.isLoading}
    >
      <Narrative
        values={narrativeValues}
        onSubmit={(values) => {
          mutation.mutate(values);
        }}
        additionalCopilotInfo={{ action }}
        placeholder={'Write a narrative explaining the reason and findings, if any.'}
        entityType={'TRANSACTION'}
        onChange={setNarrativeValues}
        possibleReasons={reasons}
        showErrors={alwaysShowErrors}
        isCopilotEnabled={true}
        otherReason={OTHER_REASON}
        formRef={formRef}
        entityIds={transactionIds}
      />
    </Modal>
  );
}
