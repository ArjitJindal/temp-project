import { useState } from 'react';
import SettingsCard from '../SettingsCard';
import s from './index.module.less';
import { useApi } from '@/api';
import { TenantApiKey } from '@/apis';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import Table from '@/components/library/Table';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { useQuery } from '@/utils/queries/hooks';
import EyeOutlined from '@/components/ui/icons/Remix/system/eye-line.react.svg';
import FileCopyOutlined from '@/components/ui/icons/Remix/document/file-copy-line.react.svg';
import { message } from '@/components/library/Message';
import Tooltip from '@/components/library/Tooltip';
import { useReloadSettings, useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import Alert from '@/components/library/Alert';
import { DATE_TIME_FORMAT_WITHOUT_SECONDS, dayjs } from '@/utils/dayjs';

export const ApiKeysSettings = () => {
  const api = useApi();
  const [unmaskedApiKey, setUnmaskedApiKey] = useState<string | undefined>(undefined);
  const reloadSettings = useReloadSettings();

  const queryResult = useQuery(
    ['apiKeys', { unmaskedApiKey }],
    async () =>
      await api.getTenantApiKeys({
        ...(unmaskedApiKey && { unmask: true, unmaskApiKeyId: unmaskedApiKey }),
      }),
    {
      onSuccess: () => {
        reloadSettings();
      },
    },
  );

  const settings = useSettings();

  const columnHelper = new ColumnHelper<TenantApiKey>();

  return (
    <SettingsCard title="API keys" description="View your API keys.">
      <AsyncResourceRenderer resource={queryResult.data}>
        {(apiKeys) => (
          <>
            <Table<TenantApiKey>
              data={{ items: apiKeys }}
              pagination={false}
              columns={[
                columnHelper.simple({
                  title: 'Name',
                  key: 'id',
                  type: {
                    render: () => <>{'x-api-key'}</>,
                  },
                }),
                columnHelper.simple({
                  title: 'Key',
                  type: {
                    render: (key, data) => {
                      const timesLeft = Math.max(
                        (settings.limits?.apiKeyView ?? 0) -
                          (settings?.apiKeyViewData?.find((d) => d.apiKey === data.item.id)
                            ?.count ?? 0),
                        0,
                      );

                      return (
                        <div className={s.root}>
                          <div>
                            <p className={s.apiText}>{key}</p>
                          </div>
                          <div className={s.iconsRoot}>
                            <div>
                              {key?.includes('********') ? (
                                <Tooltip
                                  title={
                                    timesLeft
                                      ? `You can only view this key ${timesLeft} more times`
                                      : 'You have reached the maximum number of views for this key'
                                  }
                                >
                                  <EyeOutlined
                                    height={16}
                                    width={16}
                                    onClick={() => {
                                      if (!timesLeft) {
                                        return;
                                      }
                                      setUnmaskedApiKey(data.item.id);
                                    }}
                                  />
                                </Tooltip>
                              ) : (
                                <FileCopyOutlined
                                  height={16}
                                  width={16}
                                  onClick={() => {
                                    navigator.clipboard.writeText(key ?? '');
                                    message.success('Copied to clipboard');
                                  }}
                                />
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    },
                    defaultWrapMode: 'WRAP',
                  },
                  key: 'key',
                  defaultWidth: 600,
                }),
                columnHelper.simple({
                  title: 'Created at',
                  key: 'createdAt',
                  type: {
                    render: (key, data) => {
                      return (
                        <>{dayjs(data.item.createdAt).format(DATE_TIME_FORMAT_WITHOUT_SECONDS)}</>
                      );
                    },
                    defaultWrapMode: 'WRAP',
                  },
                }),
              ]}
              rowKey="id"
            />
            <br />
            <br />
            {apiKeys.map((apiKey) => {
              const timesLeft = Math.max(
                (settings.limits?.apiKeyView ?? 0) -
                  (settings?.apiKeyViewData?.find((d) => d.apiKey === apiKey.id)?.count ?? 0),
                0,
              );

              return timesLeft === 1 ? (
                <Alert type="error">{`You can view API key ${timesLeft} more time`}</Alert>
              ) : null;
            })}
          </>
        )}
      </AsyncResourceRenderer>
    </SettingsCard>
  );
};
