import { useAuth0 } from '@auth0/auth0-react';
import { P } from '../ui/Typography';
import { COLORS_V2_ALERT_CRITICAL } from '../ui/colors';
import Button from '../library/Button';
import s from './index.module.less';
import { getBranding } from '@/utils/branding';
import AlertIcon from '@/components/ui/icons/Remix/system/alert-fill.react.svg';
import LogOutIcon from '@/components/AppWrapper/Menu/Footer/UserPanel/log-out.react.svg';

export const SuspendedAccount = () => {
  const branding = getBranding();
  const { logout } = useAuth0();

  return (
    <div className={s.root}>
      <img src={branding.logoDark} alt={branding.companyName} className={s.logo} />
      <div className={s.content}>
        <AlertIcon color={COLORS_V2_ALERT_CRITICAL} height={24} width={24} />
        <P bold>Account suspended</P>
      </div>
      <P className={s.message} variant="m">
        Your account has been suspended due to overdue invoices and/or violating the terms of the
        Master Services Agreement. Please contact{' '}
        <a href={`mailto:${branding.supportEmail}`}>{branding.supportEmail}</a> if you have any
        questions.
      </P>
      <Button
        onClick={() => logout({ returnTo: window.location.origin })}
        icon={<LogOutIcon />}
        className={s.button}
      >
        Log out
      </Button>
    </div>
  );
};
