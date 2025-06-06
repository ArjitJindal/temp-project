import { useState } from 'react';
import { humanizeConstant } from '@flagright/lib/utils/humanize';
import s from './index.module.less';
import KYCChangeModal from './KYCChangeModal';
import Icon from '@/components/ui/icons/Remix/design/pencil-line.react.svg';
import { Comment, InternalBusinessUser, InternalConsumerUser } from '@/apis';
import { KYCStatus } from '@/apis/models/KYCStatus';
import { CommentType, useHasResources } from '@/utils/user-utils';
import Tooltip from '@/components/library/Tooltip';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import Skeleton from '@/components/library/Skeleton';
import { AsyncResource, isSuccess } from '@/utils/asyncResource';

interface Props {
  title: string;
  userRes: AsyncResource<InternalConsumerUser | InternalBusinessUser>;
  onNewComment: (newComment: Comment, commentType: CommentType, personId?: string) => void;
}

export default function KycStatusEditor(props: Props) {
  const { userRes, title, onNewComment } = props;
  const [modalVisible, setModalVisible] = useState(false);
  const [kycChanged, setKycChanged] = useState(false);
  const [newKycStatus, setnewKycStatus] = useState('');
  const settings = useSettings();
  const hasUserOveviewWritePermissions = useHasResources(['write:::users/user-overview/*']);

  return (
    <div>
      <div className={s.row}>
        <span className={s.title}>{title}</span>
        {hasUserOveviewWritePermissions && !settings.kycUserStatusLock ? (
          <Tooltip
            placement="bottomLeft"
            arrowPointAtCenter
            title="Click to edit or update KYC status of the user. "
          >
            <Icon className={s.icon} onClick={() => setModalVisible(true)} />
          </Tooltip>
        ) : (
          ''
        )}
      </div>
      <p>
        <Skeleton res={userRes}>
          {(user) =>
            humanizeConstant(kycChanged ? newKycStatus : user.kycStatusDetails?.status ?? '')
          }
        </Skeleton>
      </p>
      {isSuccess(userRes) && (
        <KYCChangeModal
          isVisible={modalVisible}
          onClose={() => setModalVisible(false)}
          title="Update KYC status"
          user={userRes.value}
          onOkay={(kycStatus: KYCStatus | '', comment: Comment): void => {
            setKycChanged(true);
            setnewKycStatus(kycStatus);
            onNewComment(comment, CommentType.COMMENT);
          }}
        />
      )}
    </div>
  );
}
