import React, { useState } from 'react';
import { TooltipPlacement } from 'antd/lib/tooltip';
import PopupContent from './PopupContent';
import s from './style.module.less';
import Popover from '@/components/ui/Popover';
import { AllUsersTableItem } from '@/apis';

interface Props {
  children: React.ReactNode;
  placement?: TooltipPlacement;
  initialSearch: string | null;
  onConfirm: (user: AllUsersTableItem) => void;
  onEnterInput: (userId: string) => void;
}

export default function UserSearchPopup(props: Props) {
  const { children, initialSearch, placement = 'bottomLeft', onConfirm, onEnterInput } = props;
  const [visible, setVisible] = useState(false);

  return (
    <Popover
      disableInnerPadding
      content={
        <div className={s.popupContentWrapper}>
          <PopupContent
            initialSearch={initialSearch ?? ''}
            isVisible={visible}
            onConfirm={(user) => {
              onConfirm(user);
              setVisible(false);
            }}
            onCancel={() => {
              setVisible(false);
            }}
            onEnterInput={(userId) => {
              onEnterInput(userId);
            }}
          />
        </div>
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
