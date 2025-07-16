import React, { useState } from 'react';
import { TooltipPlacement } from 'antd/lib/tooltip';
import PopupContent from './PopupContent';
import s from './style.module.less';
import Popover from '@/components/ui/Popover';
import { AllUsersTableItemPreview } from '@/apis';
import { UserSearchParams } from '@/pages/users/users-list';

interface Props {
  children: React.ReactNode;
  placement?: TooltipPlacement;
  initialSearch: string | null;
  onConfirm: (user: AllUsersTableItemPreview) => void;
  onEnterInput: (userId: string) => void;
  params?: UserSearchParams;
  handleChangeParams?: (params: UserSearchParams) => void;
  onClose?: () => void;
}

export default function UserSearchPopup(props: Props) {
  const {
    children,
    initialSearch,
    placement = 'bottomLeft',
    onConfirm,
    onEnterInput,
    params,
    handleChangeParams,
    onClose,
  } = props;
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
            params={params}
            handleChangeParams={handleChangeParams}
            onClose={onClose}
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
