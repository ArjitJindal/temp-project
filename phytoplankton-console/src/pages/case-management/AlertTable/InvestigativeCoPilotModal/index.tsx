import React from 'react';
import InvestigativeCoPilot from './InvestigativeCoPilot';
import Modal from '@/components/library/Modal';

interface Props {
  alertId: string | undefined;
  caseId: string | undefined;
  onClose: () => void;
}

export default function InvestigativeCoPilotModal(props: Props) {
  const { alertId, caseId, onClose } = props;
  return (
    <Modal
      title={'AI Forensics'}
      isOpen={alertId != null && caseId != null}
      onCancel={onClose}
      hideFooter={true}
      disablePadding={true}
      width="XL"
      height="FULL"
    >
      {alertId && caseId && (
        <InvestigativeCoPilot key={alertId} alertId={alertId} caseId={caseId} />
      )}
    </Modal>
  );
}
