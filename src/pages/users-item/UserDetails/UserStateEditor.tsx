import { message, Select } from 'antd';
import { useCallback, useState } from 'react';
import { InternalBusinessUser, InternalConsumerUser } from '@/apis';
import { USER_STATES } from '@/utils/api/users';
import { useApi } from '@/api';
import { UserState } from '@/apis/models/UserState';
import { UserStateDetails } from '@/apis/models/UserStateDetails';
import { useHasPermissions } from '@/utils/user-utils';

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
    async (newState: UserState) => {
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
        message.error('Failed to save');
      } finally {
        hideMessage();
      }
    },
    [api, user.type, user.userId],
  );
  return (
    <Select
      style={{ minWidth: 140 }}
      allowClear
      options={USER_STATES.map((state) => ({ value: state, label: state }))}
      value={userStateDetails?.state}
      onChange={handleChangeUserState}
      placeholder="Please select"
      disabled={!hasUserOveviewWritePermissions}
    />
  );
}
