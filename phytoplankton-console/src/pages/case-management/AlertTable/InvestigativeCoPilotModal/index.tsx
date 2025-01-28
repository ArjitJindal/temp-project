import React from 'react';
import InvestigativeCoPilot from './InvestigativeCoPilot';
import s from './index.module.less';
import Modal from '@/components/library/Modal';
import InvestigativeCoPilotAlertInfo from '@/pages/case-management/AlertTable/InvestigativeCoPilotModal/InvestigativeCoPilot/InvestigativeCoPilotAlertInfo';

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
      <div className={s.root}>
        {alertId && caseId && (
          <>
            <InvestigativeCoPilotAlertInfo alertId={alertId} caseId={caseId} />
            <div className={s.copilotContainer}>
              <InvestigativeCoPilot key={alertId} alertId={alertId} />
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
