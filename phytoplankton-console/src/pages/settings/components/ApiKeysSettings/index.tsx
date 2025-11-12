import { useState } from 'react';
import pluralize from 'pluralize';
import s from './index.module.less';
import SettingsCard from '@/components/library/SettingsCard';
import { useApi } from '@/api';
import { TenantApiKey } from '@/apis';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import Table from '@/components/library/Table';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { useQuery } from '@/utils/queries/hooks';
import EyeOutlined from '@/components/ui/icons/Remix/system/eye-line.react.svg';
import FileCopyOutlined from '@/components/ui/icons/Remix/document/file-copy-line.react.svg';
import { message } from '@/components/library/Message';
import Tooltip from '@/components/library/Tooltip';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import Alert from '@/components/library/Alert';
import { DATE_TIME_FORMAT_WITHOUT_SECONDS, dayjs } from '@/utils/dayjs';
import { useAuth0User } from '@/utils/user-utils';
import { isWhiteLabeled } from '@/utils/branding';
import { copyTextToClipboard } from '@/utils/browser';
import { getErrorMessage } from '@/utils/lang';
import Button from '@/components/library/Button';
import { useMutation } from '@/utils/queries/mutations/hooks';
import Tag from '@/components/library/Tag';
import { isValidManagedRoleName } from '@/apis/models-custom/ManagedRoleName';
import Confirm from '@/components/utils/Confirm';

const getDaysLeftForDeactivation = (timestamp: number) => {
  const now = Date.now();
  const deletionDate = dayjs(timestamp);
  const daysDiff = deletionDate.diff(now, 'day');
  return {
    message: `API key will be deactivated in ${daysDiff} ${pluralize('day', daysDiff)}`,
    daysToDeactivate: daysDiff,
  };
};

const getDeactivationInfo = (deactivationTimestamp?: number) => {
  if (!deactivationTimestamp) {
    return { daysToDeactivate: 0, message: '' };
  }

  const { daysToDeactivate, message } = getDaysLeftForDeactivation(deactivationTimestamp);
  return { daysToDeactivate, message };
};

export const ApiKeysSettings = () => {
  const api = useApi();
  const user = useAuth0User();
  const [unmaskingId, setUnmaskingId] = useState<string | null>(null);
  const [unmaskedApiKey, setUnmaskedApiKey] = useState<string | undefined>(undefined);
  const hasDefaultRole = isValidManagedRoleName(user.role);

  const queryResult = useQuery(
    ['apiKeys', { unmaskedApiKey }],
    async () =>
      await api.getTenantApiKeys({
        ...(unmaskedApiKey && { unmask: true, unmaskApiKeyId: unmaskedApiKey }),
      }),
    {
      refetchOnWindowFocus: false,
    },
  );

  const rotateApiKeyMutation = useMutation<unknown, unknown, { apiKeyId: string }>(
    async ({ apiKeyId }): Promise<void> => {
      await api.rotateApiKey({
        RotateApiKeyRequest: {
          apiKeyId,
        },
      });
    },
    {
      onMutate: () => {
        message.info(`Marking API key for rotation and deactivation`);
      },
      onSuccess: () => {
        message.success(`This API key was rotated and will be deactivated in 7 days`);
        queryResult.refetch();
      },
      onError: (error) => {
        message.fatal(`Unable to rotate api key! ${getErrorMessage(error)}`, error);
      },
    },
  );

  const settings = useSettings();

  const generateApiUrl = (environment, region) => {
    const envUrls = {
      prod: `https://${region}.api.flagright.com`,
      sandbox:
        region === 'eu-1'
          ? 'https://sandbox.api.flagright.com'
          : `https://sandbox-${region}.api.flagright.com`,
      dev: 'https://api.flagright.dev',
      'dev:user': 'https://api.flagright.dev',
      local: `https://region.api.flagright.com`,
    };

    return envUrls[environment];
  };

  const columnHelper = new ColumnHelper<TenantApiKey>();

  return (
    <SettingsCard
      title="API details"
      description="View your API details."
      minRequiredResources={['read:::settings/developers/api-keys/*']}
    >
      <AsyncResourceRenderer resource={queryResult.data}>
        {(apiKeys) => (
          <>
            <Table<TenantApiKey>
              data={{ items: apiKeys }}
              pagination={false}
              tableId="api-keys-table"
              columns={[
                columnHelper.simple({
                  title: 'Header name',
                  key: 'id',
                  type: {
                    render: (_, { item: entity }) => {
                      const { daysToDeactivate, message } = getDeactivationInfo(
                        entity.deactivationTimestamp,
                      );
                      return (
                        <div className={s.headerName}>
                          <span>{'x-api-key'}</span>
                          {(() => {
                            const isDeactivated =
                              !entity.enabled ||
                              (entity.deactivationTimestamp && daysToDeactivate <= 0);
                            const isPendingDeactivation = daysToDeactivate > 0;

                            if (isDeactivated) {
                              return <Tag>Deactivated</Tag>;
                            }

                            if (isPendingDeactivation) {
                              return (
                                <Tooltip title={message}>
                                  <span>
                                    <Tag>Pending deactivation</Tag>
                                  </span>
                                </Tooltip>
                              );
                            }

                            return null;
                          })()}
                        </div>
                      );
                    },
                  },
                }),
                ...(!isWhiteLabeled()
                  ? [
                      columnHelper.display({
                        title: 'URL',
                        render: () => <>{generateApiUrl(process.env.ENV_NAME, user.region)}</>,
                      }),
                    ]
                  : []),

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

                      const { daysToDeactivate, message: deactivationTooltip } =
                        getDeactivationInfo(data.item.deactivationTimestamp);

                      return (
                        <div className={s.root}>
                          <div>
                            <p className={s.apiText}>{key}</p>
                          </div>
                          <div className={s.iconsRoot}>
                            <div>
                              {key?.includes('********') ? (
                                <Tooltip
                                  title={(() => {
                                    const isDeactivated =
                                      !data.item.enabled ||
                                      (data.item.deactivationTimestamp && daysToDeactivate <= 0);

                                    if (isDeactivated) {
                                      return 'Deactivated';
                                    }

                                    if (data.item.deactivationTimestamp) {
                                      return deactivationTooltip;
                                    }

                                    if (timesLeft) {
                                      return `You can only view this key ${timesLeft} more times`;
                                    }

                                    return 'You have reached the maximum number of views for this key';
                                  })()}
                                >
                                  <EyeOutlined
                                    height={16}
                                    width={16}
                                    style={{
                                      opacity: unmaskingId === data.item.id ? 0.5 : 1,
                                      cursor: unmaskingId ? 'wait' : 'pointer',
                                    }}
                                    onClick={async () => {
                                      if (
                                        !timesLeft ||
                                        unmaskingId ||
                                        data.item.deactivationTimestamp
                                      ) {
                                        return;
                                      }
                                      setUnmaskingId(data.item.id);
                                      setUnmaskedApiKey(data.item.id);
                                      try {
                                        await queryResult.refetch();
                                      } catch (error) {
                                        message.error(
                                          `Failed to unmask: ${getErrorMessage(error)}`,
                                        );
                                      } finally {
                                        setUnmaskingId(null);
                                      }
                                    }}
                                  />
                                </Tooltip>
                              ) : (
                                <FileCopyOutlined
                                  height={16}
                                  width={16}
                                  onClick={async () => {
                                    if (data.item.deactivationTimestamp) {
                                      return;
                                    }
                                    try {
                                      await copyTextToClipboard(key ?? '');
                                      message.success('API key copied to clipboard');
                                    } catch (error) {
                                      message.error(`Failed to copy: ${getErrorMessage(error)}`);
                                    }
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
                columnHelper.display({
                  title: 'Actions',
                  defaultSticky: 'RIGHT',
                  render: (_, { item: entity }) => (
                    // only allow user with default role with api key developer write permisssion
                    <Confirm
                      title="Rotate API key"
                      text={'This will deactive your current API key in one week. Are you sure?'}
                      onConfirm={async () => {
                        if (entity.id) {
                          rotateApiKeyMutation.mutate({ apiKeyId: entity.id });
                        }
                      }}
                    >
                      {({ onClick }) => (
                        <div className={s.actionsContainer}>
                          <Button
                            type="SECONDARY"
                            size="SMALL"
                            onClick={onClick}
                            // requiredResources={['write:::settings/developers/api-keys/*']}
                            isDisabled={
                              !!entity.deactivationTimestamp ||
                              !hasDefaultRole ||
                              rotateApiKeyMutation.dataResource.kind === 'LOADING'
                            }
                          >
                            Rotate
                          </Button>
                        </div>
                      )}
                    </Confirm>
                  ),
                }),
              ]}
              rowKey="id"
            />
            <br />
            <br />
            {apiKeys.map((apiKey, index) => {
              const timesLeft = Math.max(
                (settings.limits?.apiKeyView ?? 0) -
                  (settings?.apiKeyViewData?.find((d) => d.apiKey === apiKey.id)?.count ?? 0),
                0,
              );

              return timesLeft === 1 ? (
                <Alert
                  type="ERROR"
                  key={index}
                >{`You can view API key ${timesLeft} more time`}</Alert>
              ) : null;
            })}
          </>
        )}
      </AsyncResourceRenderer>
    </SettingsCard>
  );
};
