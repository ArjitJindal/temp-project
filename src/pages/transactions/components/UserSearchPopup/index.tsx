import React, { useState } from 'react';
import { Popover } from 'antd';
import { TooltipPlacement } from 'antd/lib/tooltip';
import PopupContent from './PopupContent';
import s from './style.module.less';
import { Mode, User } from './types';
import { useTableScrollVisible } from '@/utils/hooks';

interface Props {
  children: React.ReactNode;
  placement?: TooltipPlacement;
  initialSearch: string | null;
  initialMode?: Mode | null;
  onConfirm: (user: User, mode: Mode | null) => void;
  showOriginAndDestination?: boolean;
}

export default function UserSearchPopup(props: Props) {
  const {
    children,
    initialSearch,
    initialMode = null,
    placement = 'bottomLeft',
    onConfirm,
    showOriginAndDestination = true,
  } = props;
  const [visible, setVisible] = useState(false);

  useTableScrollVisible(setVisible);

  return (
    <Popover
      overlayClassName={s.popover}
      overlayInnerStyle={{ padding: 0 }}
      content={
        <PopupContent
          initialSearch={initialSearch ?? ''}
          initialMode={initialMode}
          isVisible={visible}
          showOriginAndDestination={showOriginAndDestination}
          onConfirm={(user, mode) => {
            onConfirm(user, mode);
            setVisible(false);
          }}
          onCancel={() => {
            setVisible(false);
          }}
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
