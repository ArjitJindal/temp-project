import cn from 'clsx';
import { useContext } from 'react';
import s from './index.module.less';
import AdminIcon from '@/components/ui/icons/Remix/user/admin-line.react.svg';
import { SuperAdminModeContext } from '@/components/AppWrapper/Providers/SuperAdminModeProvider';
import { isSuperAdmin, useAuth0User } from '@/utils/user-utils';

const OPTIONS = [
  { value: false, title: 'OFF' },
  { value: true, title: 'ON' },
];

export default function SuperAdminModeSwitch() {
  const context = useContext(SuperAdminModeContext);
  const user = useAuth0User();
  return isSuperAdmin(user) ? (
    <div className={cn(s.root)}>
      <div className={cn(s.button)}>
        <AdminIcon className={s.icon} />
        {
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
        }
      </div>
    </div>
  ) : null;
}
