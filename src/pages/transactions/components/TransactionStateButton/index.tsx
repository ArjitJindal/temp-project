import React, { useState } from 'react';
import { Popover } from 'antd';
import s from './style.module.less';
import PopupContent from './PopupContent';
import HealthLineIcon from '@/components/ui/icons/Remix/health/pulse-line.react.svg';
import ActionButton from '@/components/ui/Table/ActionButton';
import { TransactionState } from '@/apis';
import {
  getTransactionStateLabel,
  useSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';

interface Props {
  transactionStates: TransactionState[];
  onConfirm: (state: TransactionState[]) => void;
}

export function TransactionStateButton(props: Props) {
  const settings = useSettings();
  const { transactionStates, onConfirm } = props;
  const [visible, setVisible] = useState(false);

  const buttonText =
    transactionStates.length > 0
      ? transactionStates
          .map((transactionState) => getTransactionStateLabel(transactionState, settings))
          .join(', ')
      : 'Transaction State';
  return (
    <Popover
      overlayClassName={s.popover}
      overlayInnerStyle={{ padding: 0 }}
      content={<PopupContent value={transactionStates} key={`${visible}`} onConfirm={onConfirm} />}
      trigger="click"
      placement="bottomLeft"
      visible={visible}
      onVisibleChange={setVisible}
    >
      <ActionButton
        color="TURQUOISE"
        icon={<HealthLineIcon />}
        analyticsName="state-filter"
        isActive={transactionStates.length !== 0}
        onClear={() => {
          onConfirm([]);
        }}
        title={buttonText}
      >
        {buttonText}
      </ActionButton>
    </Popover>
  );
}
