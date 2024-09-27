import React from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { P } from '../ui/Typography';
import { COLORS_V2_ALERT_CRITICAL } from '../ui/colors';
import { BaseButton } from '../library/Button';
import s from './index.module.less';
import { getBranding } from '@/utils/branding';
import AlertIcon from '@/components/ui/icons/Remix/system/alert-fill.react.svg';
import LogOutIcon from '@/components/AppWrapper/Menu/Footer/UserPanel/log-out.react.svg';

interface AccountMessageProps {
  title: string;
  message: string;
}

export const AccountMessage: React.FC<AccountMessageProps> = ({ title, message }) => {
  const branding = getBranding();
  const { logout } = useAuth0();

  return (
    <div className={s.root}>
      <img src={branding.logoDark} alt={branding.companyName} className={s.logo} />
      <div className={s.content}>
        <AlertIcon color={COLORS_V2_ALERT_CRITICAL} height={24} width={24} />
        <P bold>{title}</P>
      </div>
      <P className={s.message} variant="m">
        {message} Please contact{' '}
        <a href={`mailto:${branding.supportEmail}`}>{branding.supportEmail}</a> if you have any
        questions.
      </P>
      <BaseButton
        onClick={() => logout({ returnTo: window.location.origin })}
        icon={<LogOutIcon />}
        className={s.button}
      >
        Log out
      </BaseButton>
    </div>
  );
};
