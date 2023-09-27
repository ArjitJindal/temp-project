import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import Toggle from '../library/Toggle';
import Label from '../library/Label';
import { message } from '../library/Message';
import { useSettings } from '../AppWrapper/Providers/SettingsProvider';
import AsyncResourceRenderer from '../common/AsyncResourceRenderer';
import Tooltip from '../library/Tooltip';
import { useQuery } from '@/utils/queries/hooks';
import { useApi } from '@/api';
import { DEFAULT_MERCHANT_MOITORING_LIMIT } from '@/utils/default-limits';

type Props = {
  userId: string;
  isMonitoring: boolean;
};

export const MerchantMonitoringToggle = (props: Props) => {
  const { userId, isMonitoring } = props;
  const [isMonitoringEnabled, setIsMonitoringEnabled] = useState(isMonitoring);
  const api = useApi();
  const settings = useSettings();
  const maxMerchantMonitoring =
    settings.limits?.ongoingMerchantMonitoringUsers ?? DEFAULT_MERCHANT_MOITORING_LIMIT;

  const queryResult = useQuery(['users', 'merchant-monitoring'], () =>
    api.getMerchantMonitoringStats(),
  );

  const mutation = useMutation(
    async (status: boolean) => {
      await api.postUpdateMonitoringStatus({
        userId,
        UpdateMonitoringStatusRequest: {
          isMonitoringEnabled: status,
        },
      });
    },
    {
      onSuccess: () => {
        setIsMonitoringEnabled(!isMonitoringEnabled);
        message.success('Monitoring status updated successfully');
        queryResult.refetch();
      },
      onError: (error: Error) => {
        message.error(`Failed to update monitoring status: ${error.message}`);
      },
    },
  );

  return (
    <AsyncResourceRenderer resource={queryResult.data}>
      {({ count }) => {
        return count >= maxMerchantMonitoring && !isMonitoringEnabled ? (
          <Tooltip title="You have reached the limit of ongoing merchant monitoring users. Please contact support to increase the limit.">
            <div>
              <Label label={'Ongoing merchant monitoring'} level={3}>
                <Toggle size="SMALL" value={isMonitoringEnabled} disabled={true} />
              </Label>
            </div>
          </Tooltip>
        ) : (
          <Label label={'Ongoing merchant monitoring'} level={3}>
            <Toggle
              size="SMALL"
              value={isMonitoringEnabled}
              onChange={() => mutation.mutate(!isMonitoringEnabled)}
            />
          </Label>
        );
      }}
    </AsyncResourceRenderer>
  );
};
