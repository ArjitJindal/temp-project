import React, { useEffect, useMemo, useRef, useState } from 'react';
import pluralize from 'pluralize';
import { SanctionsHitReasons, SanctionsHitStatus } from '@/apis';
import Narrative, { NarrativeFormValues, NarrativeRef } from '@/components/Narrative';
import Modal from '@/components/library/Modal';
import Checkbox from '@/components/library/Checkbox';
import { Mutation } from '@/utils/queries/types';
import { isLoading } from '@/utils/asyncResource';
import { FormRef } from '@/components/library/Form';
import Label from '@/components/library/Label';
import { neverReturn } from '@/utils/lang';
import { sanitizeComment } from '@/components/markdown/MarkdownEditor/mention-utlis';
import { usePrevious } from '@/utils/hooks';

type FormState = NarrativeFormValues<
  SanctionsHitReasons,
  {
    whitelistHits?: boolean;
    removeHitsFromWhitelist?: boolean;
  }
>;
type FormValues = FormState['values'];

interface Props {
  entityIds: string[];
  isVisible: boolean;
  onClose: () => void;
  newStatus: SanctionsHitStatus;
  updateMutation: Mutation<
    unknown,
    unknown,
    FormValues & { newStatus: SanctionsHitStatus },
    unknown
  >;
}

export default function SanctionsHitStatusChangeModal(props: Props) {
  const { newStatus, updateMutation, entityIds, isVisible, onClose } = props;

  const possibleReasons = useMemo(() => getReasons(newStatus), [newStatus]);
  const initialFormState: FormState = useMemo(
    () => ({
      values: {
        reasons: possibleReasons.slice(0, 1),
        reasonOther: undefined,
        comment: undefined,
        whitelistHits: true,
        removeHitsFromWhitelist: true,
        files: [],
      },
      isValid: false,
    }),
    [possibleReasons],
  );

  const [formState, setFormState] = useState<FormState>(initialFormState);
  const preNewStatus = usePrevious(newStatus);

  // When TRUE_POSITIVE is selected, automatically uncheck the whitelist checkbox initially.
  // Users can subsequently modify the whitelist checkbox state if desired.
  const [hasUncheckedWhitelist, setHasUncheckedWhitelist] = useState(false);

  useEffect(() => {
    if (preNewStatus !== newStatus) {
      narrativeRef?.current?.reset();
      formRef.current?.resetFields(initialFormState.values);
      setFormState(initialFormState);
      setHasUncheckedWhitelist(false);
    }
  }, [initialFormState, preNewStatus, newStatus]);

  useEffect(() => {
    if (formState.values.reasons?.includes('TRUE_POSITIVE') && !hasUncheckedWhitelist) {
      formRef.current?.setValues({
        ...formState.values,
        whitelistHits: false,
      });
      setHasUncheckedWhitelist(true);
    }
  }, [formState.values, formState.values.reasons, hasUncheckedWhitelist]);

  const formRef = useRef<FormRef<FormValues>>(null);
  const narrativeRef = useRef<NarrativeRef>(null);

  const handleConfirm = (
    formValues: FormValues & {
      newStatus: SanctionsHitStatus;
    },
  ) => {
    const sanitizedComment = formValues.comment ? sanitizeComment(formValues.comment) : '';
    updateMutation.mutate(
      { ...formValues, comment: sanitizedComment },
      {
        onSuccess: () => {
          onClose();
        },
      },
    );
  };

  return (
    <Modal
      title={getTitle(newStatus)}
      isOpen={isVisible}
      okProps={{
        isLoading: isLoading(updateMutation.dataResource),
        isDisabled: !formState.isValid,
      }}
      width="S"
      footerExtra={
        <>
          {newStatus === 'CLEARED' && (
            <Label
              label={`Whitelist selected ${pluralize('hit', entityIds.length)}`}
              position="RIGHT"
              level={2}
            >
              <Checkbox
                value={formState.values.whitelistHits}
                onChange={(newValue) => {
                  formRef?.current?.setValues({
                    ...formState.values,
                    whitelistHits: newValue,
                  });
                }}
              />
            </Label>
          )}
          {newStatus === 'OPEN' && (
            <Label
              label={`Remove selected ${pluralize('hit', entityIds.length)} from whitelist`}
              position="RIGHT"
              level={2}
            >
              <Checkbox
                value={formState.values.removeHitsFromWhitelist}
                onChange={(newValue) => {
                  formRef?.current?.setValues({
                    ...formState.values,
                    removeHitsFromWhitelist: newValue,
                  });
                }}
              />
            </Label>
          )}
        </>
      }
      okText="Confirm"
      onOk={() => {
        formRef.current?.submit();
      }}
      onCancel={() => {
        onClose();
      }}
    >
      <Narrative
        ref={narrativeRef}
        formRef={formRef}
        showErrors={false}
        values={formState}
        onChange={setFormState}
        entityType={'SANCTIONS_HIT'}
        entityIds={entityIds || []}
        placeholder={`Write a narrative explaining the hit status changes reason and findings, if any.`}
        possibleReasons={possibleReasons}
        onSubmit={(values) => {
          handleConfirm({
            ...values,
            newStatus,
          });
        }}
      />
    </Modal>
  );
}

/*
  Helpers
 */
function getReasons(newStatus: SanctionsHitStatus): SanctionsHitReasons[] {
  if (newStatus === 'OPEN') {
    return ['OTHER'];
  } else if (newStatus === 'CLEARED') {
    return ['FALSE_POSITIVE', 'TRUE_POSITIVE', 'OTHER'];
  } else if (newStatus === 'ESCALATED') {
    return ['OTHER'];
  }
  return neverReturn(newStatus, ['OTHER']);
}

function getTitle(newStatus: SanctionsHitStatus): string {
  if (newStatus === 'OPEN') {
    return 'Restore screening hits';
  } else if (newStatus === 'CLEARED') {
    return 'Clear screening hits';
  } else if (newStatus === 'ESCALATED') {
    return 'Escalate screening hits';
  }
  return neverReturn(newStatus, `Change status to "${newStatus}"`);
}
