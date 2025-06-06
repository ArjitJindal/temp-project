import React, { useState } from 'react';
import { humanizeConstant } from '@flagright/lib/utils/humanize';
import PaymentApprovalModal from './PaymentApprovalModal';
import Button from '@/components/library/Button';
import { RuleAction } from '@/apis';

interface Props {
  ids: string[];
  action: RuleAction;
  onSuccess?: () => void;
}
export default function PaymentApprovalButton({ ids, action, onSuccess }: Props) {
  const [modalVisible, setModalVisible] = useState(false);
  return (
    <>
      <Button
        type="TETRIARY"
        analyticsName="UpdateStatus"
        onClick={() => {
          setModalVisible(true);
        }}
        isDisabled={!ids.length}
        requiredResources={['write:::transactions/overview/*']}
      >
        {humanizeConstant(action)}
      </Button>

      <PaymentApprovalModal
        visible={modalVisible}
        transactionIds={ids}
        action={action}
        hide={() => setModalVisible(false)}
        onSuccess={onSuccess}
      />
    </>
  );
}
