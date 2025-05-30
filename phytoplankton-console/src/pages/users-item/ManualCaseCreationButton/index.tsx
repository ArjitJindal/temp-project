import { useState } from 'react';
import { MannualCaseCreationModal } from '../ManualCaseCreationModal';
import Button from '@/components/library/Button';
import CaseIcon from '@/components/ui/icons/Remix/business/stack-line.react.svg';

type Props = {
  userId: string;
  type: 'CREATE' | 'EDIT';
  transactionIds?: string[];
  className?: string;
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
        requiredPermissions={['case-management:case-details:write']}
        requiredResources={['write:::case-management/case-details/*']}
        className={props.className}
      >
        <CaseIcon height={15} />
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
