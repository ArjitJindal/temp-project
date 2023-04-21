import React from 'react';
import { useMutation } from '@tanstack/react-query';
import StatusChangeModal, {
  FormValues,
  OTHER_REASON,
  Props as StatusChangeModalProps,
} from '../StatusChangeModal';
import { useApi } from '@/api';
import { AlertStatus, AlertUpdateRequest } from '@/apis';
import { message } from '@/components/library/Message';
import { getErrorMessage } from '@/utils/lang';

interface Props extends Omit<StatusChangeModalProps, 'entityName' | 'updateMutation'> {
  caseId?: string;
}

export default function AlertsStatusChangeModal(props: Props) {
  const { ...rest } = props;
  const api = useApi();

  const updateMutation = useMutation<
    unknown,
    unknown,
    { ids: string[]; newStatus: AlertStatus; formValues?: FormValues }
  >(async ({ ids, newStatus, formValues }) => {
    const hideMessage = message.loading(`Saving...`);

    const updates: AlertUpdateRequest = {
      alertStatus: newStatus,
    };

    if (formValues) {
      updates.otherReason =
        formValues.reasons.indexOf(OTHER_REASON) !== -1 ? formValues.reasonOther ?? '' : undefined;
      updates.reason = formValues.reasons;
      updates.files = formValues.files;
      updates.comment = formValues.comment ?? undefined;
    }

    try {
      if (updates.alertStatus === 'ESCALATED' && props.caseId) {
        await api.postCasesCaseIdEscalate({
          caseId: props.caseId,
          CaseEscalationRequest: {
            caseUpdateRequest: updates,
            alertEscalations: ids.map((alertId) => {
              return {
                alertId,
              };
            }),
          },
        });
      } else {
        await api.postAlerts({
          AlertsUpdateRequest: {
            alertIds: ids,
            updates: updates,
          },
        });
      }
      message.success('Saved');
    } catch (e) {
      console.error(`Failed to update the alert! ${getErrorMessage(e)}`);
    } finally {
      hideMessage();
    }
  });

  return <StatusChangeModal {...rest} entityName="alert" updateMutation={updateMutation} />;
}
