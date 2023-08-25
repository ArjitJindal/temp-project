import { useState } from 'react';
import Icon from './icon.react.svg';
import s from './index.module.less';
import KYCChangeModal from './KYCChangeModal';
import { Comment, InternalBusinessUser, InternalConsumerUser } from '@/apis';
import { KYCStatus } from '@/apis/models/KYCStatus';
import { useHasPermissions } from '@/utils/user-utils';
import { humanizeConstant } from '@/utils/humanize';
import Tooltip from '@/components/library/Tooltip';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';

interface Props {
  title: string;
  user: InternalConsumerUser | InternalBusinessUser;
  onNewComment: (comment: Comment) => void;
}

export default function KycStatusEditor(props: Props) {
  const { user, title, onNewComment } = props;
  const [modalVisible, setModalVisible] = useState(false);
  const [kycChanged, setKycChanged] = useState(false);
  const [newKycStatus, setnewKycStatus] = useState('');
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
            title="Click to edit or update KYC status of the user. "
          >
            <Icon className={s.icon} onClick={() => setModalVisible(true)} />
          </Tooltip>
        ) : (
          ''
        )}
      </div>
      <p>{humanizeConstant(kycChanged ? newKycStatus : user.kycStatusDetails!.status!)}</p>
      <KYCChangeModal
        isVisible={modalVisible}
        onClose={() => setModalVisible(false)}
        title="Update KYC status"
        user={user}
        onOkay={(kycStatus: KYCStatus | '', comment: Comment): void => {
          setKycChanged(true);
          setnewKycStatus(kycStatus);
          onNewComment(comment);
        }}
      />
    </div>
  );
}
