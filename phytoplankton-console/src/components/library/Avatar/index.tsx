import cn from 'clsx';
import s from './index.module.less';
import { Account } from '@/apis';
import { getDisplayedUserInfo } from '@/utils/user-utils';
import { CY_LOADING_FLAG_CLASS } from '@/utils/cypress';

interface Props {
  user: Account | null;
  size?: 'small' | 'large' | 'medium' | 'xs';
  isLoading?: boolean;
}

const Avatar = (props: Props) => {
  const { user, size = 'small', isLoading = false } = props;
  const userInfo = getDisplayedUserInfo(user);
  const avatar = userInfo.avatar;
  return (
    <div
      className={cn(
        s.avatar,
        s[`size-${size}`],
        isLoading && s.isLoading,
        isLoading && CY_LOADING_FLAG_CLASS,
      )}
      style={{ backgroundImage: isLoading ? undefined : `url(${avatar})` }}
      title={`${userInfo.name} avatar`}
    />
  );
};

export default Avatar;
