import { useState } from 'react';
import s from './index.module.less';
import EODDChangeModal, { FormValues as EoodFormValues } from './EODDChangeModal';
import { useEODDChangeMutation } from '@/hooks/api';
import Icon from '@/components/ui/icons/Remix/design/pencil-line.react.svg';
import { InternalBusinessUser, InternalConsumerUser } from '@/apis';
import { useHasResources } from '@/utils/user-utils';
import Tooltip from '@/components/library/Tooltip';
import { AsyncResource, getOr, isLoading, isSuccess } from '@/utils/asyncResource';
import Skeleton from '@/components/library/Skeleton';
import { useFeatureEnabled } from '@/components/AppWrapper/Providers/SettingsProvider';
import {
  useUserFieldChangesPendingApprovals,
  useUserFieldChangesStrategy,
} from '@/hooks/api/workflows';
import UserPendingApprovalsModal from '@/components/ui/UserPendingApprovalsModal';
import PendingApprovalTag from '@/components/library/Tag/PendingApprovalTag';
import Confirm from '@/components/utils/Confirm';
import { dayjs } from '@/utils/dayjs';

interface Props {
  title: string;
  userRes: AsyncResource<InternalConsumerUser | InternalBusinessUser>;
}

export default function UserEODDEditor(props: Props) {
  const { title, userRes } = props;

  const [newUserEODDDate, setNewUserEODDDate] = useState<string | null>(null);

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
        <Skeleton res={userRes}>
          {(user) => <HeaderTools user={user} setNewUserEODDDate={setNewUserEODDDate} />}
        </Skeleton>
      </div>
      <p>
        <Skeleton res={userRes}>
          {(user) => {
            return formatEODDDate(newUserEODDDate != null ? newUserEODDDate : user.eoddDate);
          }}
        </Skeleton>
      </p>
    </div>
  );
}

function HeaderTools(props: {
  user: InternalConsumerUser | InternalBusinessUser;
  setNewUserEODDDate: (value: string | null) => void;
}) {
  const { user, setNewUserEODDDate } = props;
  const pendingProposals = useUserFieldChangesPendingApprovals(user.userId, ['eoddDate']);
  const hasUserOveviewWritePermissions = useHasResources(['write:::users/user-overview/*']);

  const [modalVisible, setModalVisible] = useState(false);

  const changesStrategyRes = useUserFieldChangesStrategy('eoddDate');

  const lockedByPendingProposals =
    !isSuccess(pendingProposals) || pendingProposals.value.length > 0;

  const eoodChangeMutation = useEODDChangeMutation(user, changesStrategyRes);
  return (
    <Skeleton res={changesStrategyRes}>
      {lockedByPendingProposals && !isLoading(pendingProposals) && (
        <PendingApprovalTag
          renderModal={({ isOpen, setIsOpen }) => (
            <UserPendingApprovalsModal
              userId={user.userId}
              isOpen={isOpen}
              onCancel={() => {
                setIsOpen(false);
              }}
              pendingProposalsRes={pendingProposals}
              requiredResources={['write:::users/user-overview/*']}
            />
          )}
        />
      )}
      {hasUserOveviewWritePermissions && !lockedByPendingProposals ? (
        <Tooltip placement="bottomLeft" title="Click to edit or update EODD of the user. ">
          <Icon onClick={() => setModalVisible(true)} className={s.icon} />
        </Tooltip>
      ) : (
        ''
      )}
      <Confirm<EoodFormValues>
        title={'Changes request'}
        text={
          'These changes should be approved before they are applied. Please, add a comment with the reason for the change.'
        }
        skipConfirm={getOr(changesStrategyRes, 'DIRECT') !== 'APPROVE'}
        res={eoodChangeMutation.dataResource}
        commentRequired={true}
        onConfirm={async ({ args, comment }) => {
          await eoodChangeMutation.mutateAsync({
            formValues: args,
            comment,
          });
          setModalVisible(false);
          if (getOr(changesStrategyRes, 'DIRECT') !== 'APPROVE') {
            setNewUserEODDDate(args.eoddDate);
          }
        }}
      >
        {({ onClick }) => (
          <EODDChangeModal
            res={eoodChangeMutation.dataResource}
            isVisible={modalVisible}
            user={user}
            onConfirm={(formValues): void => {
              onClick(formValues);
            }}
            onClose={() => setModalVisible(false)}
            title={`Update EODD Date`}
          />
        )}
      </Confirm>
    </Skeleton>
  );
}
