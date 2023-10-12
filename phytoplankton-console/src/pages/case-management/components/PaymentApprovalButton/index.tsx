import React, { useState } from 'react';
import { sentenceCase } from '@antv/x6/es/util/string/format';
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
        requiredPermissions={['transactions:overview:write']}
      >
        {sentenceCase(action)}
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
