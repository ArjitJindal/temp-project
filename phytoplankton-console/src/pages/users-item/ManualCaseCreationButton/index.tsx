import { useState } from 'react';
import { MannualCaseCreationModal } from '../ManualCaseCreationModal';
import Button from '@/components/library/Button';

type Props = {
  userId: string;
  type: 'CREATE' | 'EDIT';
  transactionIds?: string[];
};

export const ManualCaseCreationButton = (props: Props) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  return (
    <>
      <Button
        type="TETRIARY"
        onClick={() => {
          setIsModalOpen(true);
        }}
      >
        {props.type === 'CREATE' ? 'Create case' : 'Add to existing case'}
      </Button>
      <MannualCaseCreationModal
        isOpen={isModalOpen}
        setIsOpen={setIsModalOpen}
        userId={props.userId}
        type={props.type}
        transactionIds={props.transactionIds || []}
      />
    </>
  );
};
