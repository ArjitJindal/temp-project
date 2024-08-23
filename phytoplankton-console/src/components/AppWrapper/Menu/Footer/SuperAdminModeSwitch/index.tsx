import cn from 'clsx';
import { useContext, useState } from 'react';
import { Popover } from 'antd';
import s from './index.module.less';
import AdminIcon from '@/components/ui/icons/Remix/user/admin-line.react.svg';
import { SuperAdminModeContext } from '@/components/AppWrapper/Providers/SuperAdminModeProvider';
import { isSuperAdmin, useAuth0User } from '@/utils/user-utils';

const OPTIONS = [
  { value: false, title: 'OFF' },
  { value: true, title: 'ON' },
];
interface Props {
  isCollapsed: boolean;
}

export default function SuperAdminModeSwitch(props: Props) {
  const context = useContext(SuperAdminModeContext);
  const user = useAuth0User();
  const [isPopoverVisible, setPopoverVisible] = useState(false);
  const { isCollapsed } = props;
  return isSuperAdmin(user) ? (
    <Popover
      content={<Button context={context} />}
      placement="right"
      visible={isPopoverVisible}
      onVisibleChange={(visible) => {
        if (isCollapsed) {
          setPopoverVisible(visible);
        }
      }}
    >
      <div className={cn(s.root, isCollapsed && s.isCollapsed)} data-sentry-allow={true}>
        <Button isCollapsed={isCollapsed} context={context} />
      </div>
    </Popover>
  ) : null;
}

function Button(props: {
  context: {
    isSuperAdminMode: boolean;
    setIsSuperAdminMode: (value: boolean) => void;
  } | null;
  isCollapsed?: boolean;
}) {
  const { context, isCollapsed } = props;
  return (
    <div className={cn(s.button, isCollapsed && s.isCollapsed)}>
      <AdminIcon className={s.icon} />
      {isCollapsed ? null : (
        <>
          <span>Super mode</span>
          <button
            className={s.switch}
            onClick={() => {
              context?.setIsSuperAdminMode(!context.isSuperAdminMode);
            }}
          >
            {OPTIONS.map((option) => (
              <div
                key={option.title}
                className={cn(
                  s.item,
                  option.value === context?.isSuperAdminMode && (option.value ? s.isOn : s.isOff),
                )}
              >
                {option.title}
              </div>
            ))}
          </button>
        </>
      )}
    </div>
  );
}
