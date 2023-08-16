import { useState } from 'react';
import { MannualCaseCreationModal } from '../ManualCaseCreationModal';
import Button from '@/components/library/Button';

type Props = {
  userId: string;
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
        Create case
      </Button>
      <MannualCaseCreationModal
        isOpen={isModalOpen}
        setIsOpen={setIsModalOpen}
        userId={props.userId}
      />
    </>
  );
};
