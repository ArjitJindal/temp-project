import React, { useState, useRef, useMemo, useEffect } from 'react';
import { SanctionsHitReasons, SanctionsHitStatus } from '@/apis';
import Narrative, { NarrativeFormValues } from '@/components/Narrative';
import Modal from '@/components/library/Modal';
import Checkbox from '@/components/library/Checkbox';
import { Mutation } from '@/utils/queries/types';
import { isLoading } from '@/utils/asyncResource';
import { FormRef } from '@/components/library/Form';
import Label from '@/components/library/Label';
import GenericFormField from '@/components/library/Form/GenericFormField';
import { neverReturn } from '@/utils/lang';
import { sanitizeComment } from '@/components/markdown/MarkdownEditor/mention-utlis';

type FormState = NarrativeFormValues<
  SanctionsHitReasons,
  {
    whitelistHits?: boolean;
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
    FormValues & {
      newStatus: SanctionsHitStatus;
    },
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
        files: [],
      },
      isValid: false,
    }),
    [possibleReasons],
  );

  const [formState, setFormState] = useState<FormState>(initialFormState);
  useEffect(() => {
    if (!isVisible) {
      formRef.current?.resetFields(initialFormState.values);
      setFormState(initialFormState);
    }
  }, [isVisible, initialFormState]);

  const formRef = useRef<FormRef<FormValues>>(null);

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
          formRef.current?.setValues(initialFormState.values);
          setFormState(initialFormState);
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
      okText="Confirm"
      onOk={() => {
        formRef.current?.submit();
      }}
      onCancel={() => {
        onClose();
      }}
    >
      <Narrative<SanctionsHitReasons>
        formRef={formRef}
        showErrors={false}
        values={formState}
        onChange={setFormState}
        entityType={'SANCTIONS_HIT'}
        entityIds={entityIds || []}
        placeholder={`Write a narrative explaining the hit status changes reason and findings, if any.`}
        possibleReasons={possibleReasons}
        extraFields={
          <>
            {newStatus === 'CLEARED' && (
              <GenericFormField<FormValues, 'whitelistHits'> name="whitelistHits">
                {(props) => (
                  <Label label={'Whitelist the selected hits'} position="RIGHT" level={2}>
                    <Checkbox {...props} />
                  </Label>
                )}
              </GenericFormField>
            )}
          </>
        }
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
    return ['FALSE_POSITIVE', 'OTHER'];
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
