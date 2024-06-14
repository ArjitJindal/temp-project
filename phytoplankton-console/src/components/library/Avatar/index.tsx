import cn from 'clsx';
import Spinner from '../Spinner';
import s from './index.module.less';
import { Account } from '@/apis';
import { getDisplayedUserInfo } from '@/utils/user-utils';

interface Props {
  user: Account | null;
  size?: 'small' | 'large' | 'medium' | 'xs';
  isLoading?: boolean;
}

const Avatar = (props: Props) => {
  const { user, size = 'small', isLoading = false } = props;
  const userInfo = getDisplayedUserInfo(user);
  const avatar = userInfo.avatar;
  return isLoading ? (
    <div className={cn(s.avatar, s[`size-${size}`])}>
      <Spinner size="SMALL" />
    </div>
  ) : (
    <div
      className={cn(s.avatar, s[`size-${size}`])}
      style={{ backgroundImage: `url(${avatar})` }}
      title={`${userInfo.name} avatar`}
    />
  );
};

export default Avatar;
