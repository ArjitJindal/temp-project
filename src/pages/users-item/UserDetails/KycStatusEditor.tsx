import { message, Select } from 'antd';
import { useCallback, useState } from 'react';
import { InternalBusinessUser, InternalConsumerUser } from '@/apis';
import { KYC_STATUSES } from '@/utils/api/users';
import { useApi } from '@/api';
import { KYCStatus } from '@/apis/models/KYCStatus';
import { KYCStatusDetails } from '@/apis/models/KYCStatusDetails';

const updatedKYCStatusDetails: { [key: string]: KYCStatusDetails } = {};

interface Props {
  user: InternalConsumerUser | InternalBusinessUser;
}

export default function KycStatusEditor({ user }: Props) {
  const api = useApi();
  const [kycStatusDetails, setKYCStatusDetails] = useState(
    updatedKYCStatusDetails[user.userId] || user.kycStatusDetails,
  );
  const handleChangeKYCStatus = useCallback(
    async (newState: KYCStatus) => {
      const newStateDetails = {
        status: newState,
        reason: 'Manually updated from Console',
      };
      const params = {
        userId: user.userId,
        UserUpdateRequest: {
          kycStatusDetails: newStateDetails,
        },
      };
      setKYCStatusDetails(newStateDetails);
      updatedKYCStatusDetails[user.userId] = newStateDetails;
      const hideMessage = message.loading(`Saving...`, 0);
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
      style={{ minWidth: 160 }}
      options={KYC_STATUSES.map((status) => ({ value: status, label: status }))}
      value={kycStatusDetails?.status}
      onChange={handleChangeKYCStatus}
      allowClear
      placeholder="Please select"
    />
  );
}
