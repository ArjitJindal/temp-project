import React from 'react';
import InvestigativeCoPilot from './InvestigativeCoPilot';
import Modal from '@/components/library/Modal';

interface Props {
  alertId: string | undefined;
  caseUserName: string | undefined;
  onClose: () => void;
}

export default function InvestigativeCoPilotModal(props: Props) {
  const { alertId, caseUserName, onClose } = props;
  return (
    <Modal
      title={'AI Forensics'}
      isOpen={alertId != null}
      onCancel={onClose}
      hideFooter={true}
      disablePadding={true}
      width="XL"
      height="FULL"
    >
      {alertId && caseUserName && (
        <InvestigativeCoPilot alertId={alertId} caseUserName={caseUserName} />
      )}
    </Modal>
  );
}
