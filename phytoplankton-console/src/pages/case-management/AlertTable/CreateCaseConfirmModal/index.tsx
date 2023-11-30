import React from 'react';
import { useCreateNewCaseMutation } from '@/pages/case-management/AlertTable/helpers';
import { getMutationAsyncResource } from '@/utils/queries/mutations/helpers';
import Button from '@/components/library/Button';
import Confirm from '@/components/utils/Confirm';

interface ConfirmModalProps {
  selectedEntities: string[];
  caseId: string;
  onResetSelection: () => void;
}

export default function CreateCaseConfirmModal(props: ConfirmModalProps) {
  const { selectedEntities, caseId, onResetSelection } = props;
  const createNewCaseMutation = useCreateNewCaseMutation({ onResetSelection });

  return (
    <Confirm
      title="Are you sure you want to create a new Case?"
      text="Please note that creating a new case would create a new case for this user with a new Case ID with the selected Alerts."
      res={getMutationAsyncResource(createNewCaseMutation)}
      onConfirm={() => {
        createNewCaseMutation.mutate({
          sourceCaseId: caseId,
          alertIds: selectedEntities,
        });
      }}
    >
      {({ onClick }) => (
        <Button type="TETRIARY" onClick={onClick}>
          Create new case
        </Button>
      )}
    </Confirm>
  );
}
