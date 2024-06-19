import React, { useState, useRef } from 'react';
import { SanctionsHitReasons, SanctionsHitStatus } from '@/apis';
import Narrative, { NarrativeFormValues } from '@/components/Narrative';
import Modal from '@/components/library/Modal';
import Checkbox from '@/components/library/Checkbox';
import { Mutation } from '@/utils/queries/types';
import { isLoading } from '@/utils/asyncResource';
import { FormRef } from '@/components/library/Form';
import Label from '@/components/library/Label';
import GenericFormField from '@/components/library/Form/GenericFormField';

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
  updateMutation: Mutation<unknown, unknown, FormValues, unknown>;
}

const possibleReasons: SanctionsHitReasons[] = ['FALSE_POSITIVE', 'OTHER'];

const initialFormState: FormState = {
  values: {
    reasons: ['FALSE_POSITIVE'],
    reasonOther: undefined,
    comment: undefined,
    whitelistHits: true,
    files: [],
  },
  isValid: false,
};

export default function SanctionsHitStatusChangeModal(props: Props) {
  const { updateMutation, entityIds, isVisible, onClose } = props;

  const showErrors = false;
  const [formState, setFormState] = useState<FormState>(initialFormState);

  const formRef = useRef<FormRef<FormValues>>(null);

  const handleConfirm = (formValues: FormValues) => {
    updateMutation.mutate(formValues, {
      onSuccess: () => {
        onClose();
        formRef.current?.setValues(initialFormState.values);
        setFormState(initialFormState);
      },
    });
  };

  return (
    <Modal
      title={'Clear sanctions hits'}
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
        showErrors={showErrors}
        values={formState}
        onChange={setFormState}
        entityType={'SANCTIONS_HIT'}
        entityIds={entityIds || []}
        placeholder={`Write a narrative explaining the hit status changes reason and findings, if any.`}
        possibleReasons={possibleReasons}
        extraFields={
          <>
            <GenericFormField<FormValues, 'whitelistHits'> name="whitelistHits">
              {(props) => (
                <Label label={'Whitelist the selected hits'} position="RIGHT" level={2}>
                  <Checkbox {...props} />
                </Label>
              )}
            </GenericFormField>
          </>
        }
        onSubmit={handleConfirm}
      />
    </Modal>
  );
}
