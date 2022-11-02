import React, { useState } from 'react';
import { Popover } from 'antd';
import s from './style.module.less';
import PopupContent from './PopupContent';
import HealthLineIcon from '@/components/ui/icons/Remix/health/pulse-line.react.svg';
import ActionButton from '@/components/ui/Table/ActionButton';
import { TransactionState } from '@/apis';
import { getTransactionStateTitle } from '@/components/ui/TransactionStateTag';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';

interface Props {
  transactionState: TransactionState[];
  onConfirm: (state: TransactionState[]) => void;
}

export default function TransactionStateButton(props: Props) {
  const settings = useSettings();
  const { transactionState, onConfirm } = props;
  const [visible, setVisible] = useState(false);

  const buttonText =
    transactionState.length > 0
      ? transactionState
          .map(
            (x) =>
              settings.transactionStateAlias?.find((item) => item.state === x)?.alias ||
              getTransactionStateTitle(x),
          )
          .join(', ')
      : 'Transaction State';
  return (
    <Popover
      overlayClassName={s.popover}
      overlayInnerStyle={{ padding: 0 }}
      content={<PopupContent value={transactionState} key={`${visible}`} onConfirm={onConfirm} />}
      trigger="click"
      placement="bottomLeft"
      visible={visible}
      onVisibleChange={setVisible}
    >
      <ActionButton
        color="TURQUOISE"
        icon={<HealthLineIcon />}
        analyticsName="state-filter"
        isActive={transactionState.length !== 0}
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
