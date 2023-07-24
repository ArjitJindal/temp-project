import { useCallback, useState } from 'react';
import { InternalBusinessUser, InternalConsumerUser } from '@/apis';
import { USER_STATES } from '@/utils/api/users';
import { useApi } from '@/api';
import { UserState } from '@/apis/models/UserState';
import { UserStateDetails } from '@/apis/models/UserStateDetails';
import { useHasPermissions } from '@/utils/user-utils';
import { message } from '@/components/library/Message';
import { humanizeConstant } from '@/utils/humanize';
import Select from '@/components/library/Select';

// TODO: Use react-query to properly do optimistic updates
const updatedUserStateDetails: { [key: string]: UserStateDetails } = {};

interface Props {
  user: InternalConsumerUser | InternalBusinessUser;
}

export default function UserStateEditor({ user }: Props) {
  const api = useApi();
  const [userStateDetails, setUserStateDetails] = useState(
    updatedUserStateDetails[user.userId] || user.userStateDetails,
  );
  const hasUserOveviewWritePermissions = useHasPermissions(['users:user-overview:write']);
  const handleChangeUserState = useCallback(
    async (newState: UserState | undefined) => {
      if (newState == null) {
        return;
      }
      const newStateDetails = {
        state: newState,
        // TODO: Allow editing `userStateDetails.reason`
        reason: 'Manually updated from Console',
      };
      const params = {
        userId: user.userId,
        UserUpdateRequest: {
          userStateDetails: newStateDetails,
        },
      };
      setUserStateDetails(newStateDetails);
      updatedUserStateDetails[user.userId] = newStateDetails;
      const hideMessage = message.loading(`Saving...`);
      try {
        await (user.type === 'CONSUMER'
          ? api.postConsumerUsersUserId(params)
          : api.postBusinessUsersUserId(params));
        message.success('Saved');
      } catch (e) {
        message.fatal('Failed to save', e);
      } finally {
        hideMessage();
      }
    },
    [api, user.type, user.userId],
  );
  return (
    <Select
      allowClear
      options={USER_STATES.map((state) => ({ value: state, label: humanizeConstant(state) }))}
      value={userStateDetails?.state}
      onChange={handleChangeUserState}
      placeholder="Please select"
      isDisabled={!hasUserOveviewWritePermissions}
    />
  );
}
