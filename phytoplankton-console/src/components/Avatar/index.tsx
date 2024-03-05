import cn from 'clsx';
import { COLORS_V2_GRAY_3 } from '../ui/colors';
import Spinner from '../library/Spinner';
import s from './index.module.less';
import { Account } from '@/apis';
import { getBranding } from '@/utils/branding';

interface Props {
  user: Account | null;
  size?: 'small' | 'large' | 'medium';
  isLoading?: boolean;
}

const DEFAULT_AVATAR_STYLE = {
  borderRadius: '50%',
  backgroundColor: COLORS_V2_GRAY_3,
};

const Avatar = (props: Props) => {
  const { user, size = 'small', isLoading = false } = props;
  const branding = getBranding();
  const { companyName } = branding;
  const brandingName = `${companyName} System`;
  const role = user?.role;
  const systemDisplay =
    role === 'root' || brandingName === user?.name ? branding.systemAvatarUrl : null;
  const imgHeight = size === 'small' ? 16 : size === 'medium' ? 20 : 24;

  return isLoading ? (
    <div className={cn(s.avatar, s[size])}>
      <Spinner size="SMALL" />
    </div>
  ) : (
    <div
      className={cn(s.avatar, s[size])}
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
      {systemDisplay && <img src={systemDisplay} height={imgHeight} />}
    </div>
  );
};

export default Avatar;
