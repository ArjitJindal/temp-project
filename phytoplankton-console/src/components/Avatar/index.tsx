import cn from 'clsx';
import { COLORS_V2_GRAY_3 } from '../ui/colors';
import s from './index.module.less';
import { Account } from '@/apis';
import { getBranding } from '@/utils/branding';
import FlagrightNoTextLogo from '@/branding/flagright-no-text.svg';
import BureauNoTextLogo from '@/branding/bureau-favicon.svg';

interface Props {
  user: Account | null;
  size?: 'small' | 'large';
}

const DEFAULT_AVATAR_STYLE = {
  borderRadius: '50%',
  backgroundColor: COLORS_V2_GRAY_3,
};

const LOGO_URLS = {
  flagright: FlagrightNoTextLogo,
  bureau: BureauNoTextLogo,
};

const Avatar = (props: Props) => {
  const { user, size = 'small' } = props;
  const branding = getBranding();
  const { companyName } = branding;
  const brandingName = `${companyName} System`;
  const role = user?.role;
  const systemDisplay =
    role === 'root' || brandingName === user?.name ? LOGO_URLS[companyName.toLowerCase()] : null;
  return (
    <div
      className={cn(s.avatar, size === 'small' ? s.small : s.large)}
      style={
        !systemDisplay && user?.picture
          ? {
              backgroundImage: `url(${user?.picture})`,
            }
          : systemDisplay
          ? {}
          : DEFAULT_AVATAR_STYLE
      }
      title={`${user?.name || user?.email} avatar`}
    >
      {systemDisplay && <img src={systemDisplay} height={size === 'small' ? 16 : 24} />}
    </div>
  );
};

export default Avatar;
