import React from 'react';
import InvestigativeCoPilot from './InvestigativeCoPilot';
import Modal from '@/components/library/Modal';

interface Props {
  alertId: string | undefined;
  onClose: () => void;
}

export default function InvestigativeCoPilotModal(props: Props) {
  const { alertId, onClose } = props;
  return (
    <Modal
      title={'Investigative Co-pilot'}
      isOpen={alertId != null}
      onCancel={onClose}
      hideFooter={true}
      disablePadding={true}
      width="XL"
      height="FULL"
    >
      {alertId && <InvestigativeCoPilot alertId={alertId} />}
    </Modal>
  );
}
