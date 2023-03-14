import React from 'react';
import { useMutation } from '@tanstack/react-query';
import StatusChangeModal, {
  FormValues,
  OTHER_REASON,
  Props as StatusChangeModalProps,
} from '../StatusChangeModal';
import { useApi } from '@/api';
import { CaseStatus, CaseUpdateRequest } from '@/apis';
import { message } from '@/components/library/Message';
import { getErrorMessage } from '@/utils/lang';

interface Props extends Omit<StatusChangeModalProps, 'entityName' | 'updateMutation'> {}

export default function CasesStatusChangeModal(props: Props) {
  const { ...rest } = props;
  const api = useApi();

  const updateMutation = useMutation<
    unknown,
    unknown,
    { ids: string[]; newStatus: CaseStatus; formValues?: FormValues }
  >(async ({ ids, newStatus, formValues }) => {
    const hideMessage = message.loading(`Saving...`);

    const updates: CaseUpdateRequest = {
      caseStatus: newStatus,
    };

    if (formValues) {
      updates.otherReason =
        formValues.reasons.indexOf(OTHER_REASON) !== -1 ? formValues.reasonOther ?? '' : undefined;
      updates.reason = formValues.reasons;
      updates.files = formValues.files;
      updates.comment = formValues.comment ?? undefined;
    }

    try {
      await api.postCases({
        CasesUpdateRequest: {
          caseIds: ids,
          updates: updates,
        },
      });
      message.success('Saved');
    } catch (e) {
      console.error(`Failed to update the case! ${getErrorMessage(e)}`);
    } finally {
      hideMessage();
    }
  });

  return <StatusChangeModal {...rest} entityName="case" updateMutation={updateMutation} />;
}
