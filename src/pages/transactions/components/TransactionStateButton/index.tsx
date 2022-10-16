import React, { useState } from 'react';
import { Popover } from 'antd';
import _ from 'lodash';
import s from './style.module.less';
import PopupContent from './PopupContent';
import HealthLineIcon from '@/components/ui/icons/Remix/health/pulse-line.react.svg';
import ActionButton from '@/components/ui/Table/ActionButton';
import { TransactionState } from '@/apis';

interface Props {
  transactionState: TransactionState | undefined;
  onConfirm: (state: TransactionState | undefined) => void;
}

export default function StateSearchButton(props: Props) {
  const { transactionState, onConfirm } = props;
  const [visible, setVisible] = useState(false);

  return (
    <Popover
      overlayClassName={s.popover}
      overlayInnerStyle={{ padding: 0 }}
      content={
        <PopupContent
          key={`${visible}`}
          onConfirm={(transactionState) => {
            onConfirm(transactionState);
            setVisible(false);
          }}
        />
      }
      trigger="click"
      placement="bottomLeft"
      visible={visible}
      onVisibleChange={setVisible}
    >
      <ActionButton
        color="TURQUOISE"
        icon={<HealthLineIcon />}
        analyticsName="state-filter"
        isActive={transactionState != null}
        onClear={() => {
          onConfirm(undefined);
        }}
      >
        {transactionState ? _.capitalize(transactionState) : 'Transaction State'}
      </ActionButton>
    </Popover>
  );
}
