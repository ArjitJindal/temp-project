import React, { useState } from 'react';
import { Popover } from 'antd';
import { TooltipPlacement } from 'antd/lib/tooltip';
import PopupContent from './PopupContent';
import s from './style.module.less';
import { Transaction } from '@/apis';

interface Props {
  children: React.ReactNode;
  placement?: TooltipPlacement;
  initialSearch: string | null;
  onConfirm: (transaction: Transaction) => void;
}

export default function TransactionSearchPopup(props: Props) {
  const { children, initialSearch, placement = 'bottomLeft', onConfirm } = props;
  const [visible, setVisible] = useState(false);

  return (
    <Popover
      overlayClassName={s.popover}
      overlayInnerStyle={{ padding: 0 }}
      content={
        <PopupContent
          initialSearch={initialSearch ?? ''}
          onConfirm={(transaction) => {
            onConfirm(transaction);
            setVisible(false);
          }}
          onCancel={() => {
            setVisible(false);
          }}
          isVisible={visible}
        />
      }
      trigger="click"
      placement={placement}
      visible={visible}
      onVisibleChange={setVisible}
    >
      {children}
    </Popover>
  );
}
