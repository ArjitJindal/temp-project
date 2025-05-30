import { useState } from 'react';
import s from './index.module.less';
import EODDChangeModal from './EODDChangeModal';
import Icon from '@/components/ui/icons/Remix/design/pencil-line.react.svg';
import { InternalBusinessUser, InternalConsumerUser } from '@/apis';
import { useHasPermissions } from '@/utils/user-utils';
import Tooltip from '@/components/library/Tooltip';
import { AsyncResource, isSuccess } from '@/utils/asyncResource';
import Skeleton from '@/components/library/Skeleton';
import { dayjs } from '@/utils/dayjs';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';

interface Props {
  title: string;
  userRes: AsyncResource<InternalConsumerUser | InternalBusinessUser>;
}

export default function UserEODDEditor(props: Props) {
  const { title, userRes } = props;
  const [modalVisible, setModalVisible] = useState(false);
  const [newUserEODDDate, setNewUserEODDDate] = useState('');
  const [userEODDDateChanged, setUserEODDDateChanged] = useState(false);
  const hasUserOveviewWritePermissions = useHasPermissions(
    ['users:user-overview:write'],
    ['write:::users/user-overview/*'],
  );

  if (!useFeatureEnabled('PNB')) {
    return null;
  }

  const formatEODDDate = (dateValue: string | number | null | undefined): string => {
    if (!dateValue) {
      return '';
    }

    // If it's a timestamp (number or numeric string)
    if (!isNaN(Number(dateValue))) {
      return dayjs(Number(dateValue)).format('DD MMM YYYY');
    }

    // If it's already a date string
    return dayjs(dateValue).format('DD MMM YYYY');
  };

  return (
    <div>
      <div className={s.row}>
        <span className={s.title}>{title}</span>
        {hasUserOveviewWritePermissions ? (
          <Tooltip
            placement="bottomLeft"
            arrowPointAtCenter
            title="Click to edit or update EODD of the user. "
          >
            <Icon onClick={() => setModalVisible(true)} className={s.icon} />
          </Tooltip>
        ) : (
          ''
        )}
      </div>
      <p>
        <Skeleton res={userRes}>
          {(user) => formatEODDDate(userEODDDateChanged ? newUserEODDDate : user.eoddDate)}
        </Skeleton>
      </p>
      {isSuccess(userRes) && (
        <EODDChangeModal
          isVisible={modalVisible}
          user={userRes.value}
          onOkay={(eoddDate: string): void => {
            // api call to save the EODD date
            setNewUserEODDDate(eoddDate);
            setUserEODDDateChanged(true);
          }}
          onClose={() => setModalVisible(false)}
          title={`Update EODD Date`}
        />
      )}
    </div>
  );
}
