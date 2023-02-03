import { useState } from 'react';
import { Popover } from 'antd';
import UserProfileIcon from './user_profile.react.svg';
import s from './style.module.less';
import PopupContent from './PopupContent';
import ActionButton from '@/components/ui/Table/ActionButton';
import { RuleAction } from '@/apis';
import {
  getRiskActionLabel,
  useSettings,
} from '@/components/AppWrapper/Providers/SettingsProvider';
import { useTableScrollVisible } from '@/utils/hooks';

interface Props {
  status: RuleAction | undefined;
  onConfirm: (status: RuleAction | undefined) => void;
}

export default function StatusSearchButton(props: Props) {
  const { status, onConfirm } = props;
  const [visible, setVisible] = useState(false);
  const settings = useSettings();

  useTableScrollVisible(setVisible);

  return (
    <Popover
      overlayClassName={s.popover}
      overlayInnerStyle={{ padding: 0 }}
      content={
        <PopupContent
          onConfirm={(status) => {
            onConfirm(status);
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
        color="SKY_BLUE"
        icon={<UserProfileIcon />}
        analyticsName="status-filter"
        isActive={status != null}
        onClear={() => {
          onConfirm(undefined);
        }}
      >
        {getRiskActionLabel(status, settings) ?? 'Rule action'}
      </ActionButton>
    </Popover>
  );
}
