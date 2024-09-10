import { useState } from 'react';
import { humanizeConstant } from '@flagright/lib/utils/humanize';
import s from './index.module.less';
import UserChangeModal from './UserChangeModal';
import Icon from '@/components/ui/icons/Remix/design/pencil-line.react.svg';
import { InternalBusinessUser, InternalConsumerUser, Comment } from '@/apis';
import { UserState } from '@/apis/models/UserState';
import { useHasPermissions } from '@/utils/user-utils';
import Tooltip from '@/components/library/Tooltip';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';

interface Props {
  title: string;
  user: InternalConsumerUser | InternalBusinessUser;
  onNewComment: (comment: Comment) => void;
}

export default function UserStateEditor(props: Props) {
  const { user, title, onNewComment } = props;
  const [modalVisible, setModalVisible] = useState(false);
  const [newUserStatus, setnewUserStatus] = useState('');
  const [userStatusChanged, setUserStatusChanged] = useState(false);
  const settings = useSettings();
  const hasUserOveviewWritePermissions = useHasPermissions(['users:user-overview:write']);
  return (
    <div>
      <div className={s.row}>
        <span className={s.title}>{title}</span>
        {hasUserOveviewWritePermissions && !settings.kycUserStatusLock ? (
          <Tooltip
            placement="bottomLeft"
            arrowPointAtCenter
            title="Click to edit or update user status of the user. "
          >
            <Icon onClick={() => setModalVisible(true)} className={s.icon} />
          </Tooltip>
        ) : (
          ''
        )}
      </div>
      <p>
        {humanizeConstant(userStatusChanged ? newUserStatus : user.userStateDetails?.state ?? '')}
      </p>
      <UserChangeModal
        isVisible={modalVisible}
        onOkay={(userStatus: UserState | '', comment: Comment): void => {
          setUserStatusChanged(true);
          setnewUserStatus(userStatus);
          onNewComment(comment);
        }}
        onClose={() => setModalVisible(false)}
        title="Update user status "
        user={user}
      />
    </div>
  );
}
