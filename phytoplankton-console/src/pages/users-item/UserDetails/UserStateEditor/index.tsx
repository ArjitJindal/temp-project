import { useState } from 'react';
import { humanizeConstant } from '@flagright/lib/utils/humanize';
import s from './index.module.less';
import UserChangeModal from './UserChangeModal';
import Icon from '@/components/ui/icons/Remix/design/pencil-line.react.svg';
import { InternalBusinessUser, InternalConsumerUser, Comment } from '@/apis';
import { UserState } from '@/apis/models/UserState';
import { CommentType, useHasPermissions } from '@/utils/user-utils';
import Tooltip from '@/components/library/Tooltip';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { AsyncResource, isSuccess } from '@/utils/asyncResource';
import Skeleton from '@/components/library/Skeleton';

interface Props {
  title: string;
  userRes: AsyncResource<InternalConsumerUser | InternalBusinessUser>;
  onNewComment: (newComment: Comment, commentType: CommentType, personId?: string) => void;
}

export default function UserStateEditor(props: Props) {
  const { userRes, title, onNewComment } = props;
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
        <Skeleton res={userRes}>
          {(user) =>
            humanizeConstant(userStatusChanged ? newUserStatus : user.userStateDetails?.state ?? '')
          }
        </Skeleton>
      </p>
      {isSuccess(userRes) && (
        <UserChangeModal
          isVisible={modalVisible}
          onOkay={(userStatus: UserState | '', comment: Comment): void => {
            setUserStatusChanged(true);
            setnewUserStatus(userStatus);
            onNewComment(comment, CommentType.COMMENT);
          }}
          onClose={() => setModalVisible(false)}
          title={`Update ${settings.userAlias} status`}
          user={userRes.value}
        />
      )}
    </div>
  );
}
