import { useState } from 'react';
import s from './index.module.less';
import UserChangeModal from './UserChangeModal';
import Icon from '@/components/ui/icons/Remix/design/pencil-line.react.svg';
import { InternalBusinessUser, InternalConsumerUser, Comment } from '@/apis';
import { UserState } from '@/apis/models/UserState';
import { CommentType, useHasResources } from '@/utils/user-utils';
import Tooltip from '@/components/library/Tooltip';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { AsyncResource, isSuccess } from '@/utils/asyncResource';
import Skeleton from '@/components/library/Skeleton';
import { humanizeUserStatus } from '@/components/utils/humanizeUserStatus';

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
  const hasUserOveviewWritePermissions = useHasResources(['write:::users/user-overview/*']);
  return (
    <div>
      <div className={s.row}>
        <span className={s.title}>{title}</span>
        {hasUserOveviewWritePermissions && !settings.kycUserStatusLock ? (
          <Tooltip placement="bottomLeft" title="Click to edit or update user status of the user. ">
            <Icon onClick={() => setModalVisible(true)} className={s.icon} />
          </Tooltip>
        ) : (
          ''
        )}
      </div>
      <p>
        <Skeleton res={userRes}>
          {(user) =>
            humanizeUserStatus(
              (userStatusChanged ? newUserStatus : user.userStateDetails?.state ?? '') as UserState,
              settings.userStateAlias,
            )
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
