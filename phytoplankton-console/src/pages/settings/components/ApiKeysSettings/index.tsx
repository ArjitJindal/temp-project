import { useState } from 'react';
import s from './index.module.less';
import { useApi } from '@/api';
import { TenantApiKey } from '@/apis';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import Table from '@/components/library/Table';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { DATE_TIME } from '@/components/library/Table/standardDataTypes';
import { H2, P } from '@/components/ui/Typography';
import { useQuery } from '@/utils/queries/hooks';
import EyeOutlined from '@/components/ui/icons/Remix/system/eye-line.react.svg';
import FileCopyOutlined from '@/components/ui/icons/Remix/document/file-copy-line.react.svg';
import { message } from '@/components/library/Message';
import Tooltip from '@/components/library/Tooltip';
import { useReloadSettings, useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import Alert from '@/components/library/Alert';

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
    <>
      <H2>API keys</H2>
      <P grey variant="sml">
        View your API keys
      </P>
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
                columnHelper.simple({ title: 'Created on', key: 'createdAt', type: DATE_TIME }),
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
                <Alert type="error">{`You can only view ${apiKey.id} key ${timesLeft} more time`}</Alert>
              ) : null;
            })}
          </>
        )}
      </AsyncResourceRenderer>
    </>
  );
};
