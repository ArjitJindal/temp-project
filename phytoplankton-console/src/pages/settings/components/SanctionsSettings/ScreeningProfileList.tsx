import { useMemo, useState } from 'react';
import { EditOutlined, CopyOutlined, DeleteOutlined } from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import s from './styles.module.less';
import CreateScreeningProfileModal from './CreateScreeningProfileModal';
import Tooltip from '@/components/library/Tooltip';
import Toggle from '@/components/library/Toggle';
import { useQuery } from '@/utils/queries/hooks';
import { useApi } from '@/api';
import { ScreeningProfileResponse } from '@/apis';
import { SCREENING_PROFILES } from '@/utils/queries/keys';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import { TableColumn } from '@/components/library/Table/types';
import { useUsers } from '@/utils/user-utils';
import Tag from '@/components/library/Tag';
import SettingsCard from '@/components/library/SettingsCard';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { STRING, DATE } from '@/components/library/Table/standardDataTypes';
import Id from '@/components/ui/Id';
import { message } from '@/components/library/Message';
import Confirm from '@/components/utils/Confirm';
import { getErrorMessage } from '@/utils/lang';
import AccountTag from '@/components/AccountTag';

export const ScreeningProfileList = ({ hasFeature }) => {
  const api = useApi();
  const [users] = useUsers({ includeRootUsers: true, includeBlockedUsers: true });
  const [deleting, setDeleting] = useState(false);
  const [editingProfile, setEditingProfile] = useState<ScreeningProfileResponse | undefined>(
    undefined,
  );

  const queryResult = useQuery(SCREENING_PROFILES(), async () => {
    try {
      const response = await api.getScreeningProfiles();
      return {
        items: response.items || [],
        total: response.items?.length || 0,
      };
    } catch (error) {
      return {
        items: [],
        total: 0,
      };
    }
  });

  const isReadOnly = false; // !useHasResources(['screening:screening-profiles:write']);

  const updateStatusMutation = useMutation<
    void,
    Error,
    {
      screeningProfileId: string;
      status: 'ENABLED' | 'DISABLED';
      item: ScreeningProfileResponse;
    }
  >({
    mutationFn: async ({ screeningProfileId, status, item }) => {
      await api.updateScreeningProfile({
        screeningProfileId,
        ScreeningProfileRequest: {
          screeningProfileName: item.screeningProfileName || '',
          screeningProfileDescription: item.screeningProfileDescription || '',
          screeningProfileStatus: status,
          isDefault: item.isDefault || false,
        },
      });
    },
    onSuccess: () => {
      message.success('Screening profile status updated successfully');
      queryResult.refetch();
    },
    onError: (error) => {
      message.error(getErrorMessage(error) || `Failed to update screening profile status`);
    },
  });

  const deleteScreeningProfileMutation = useMutation<void, Error, string>({
    mutationFn: async (screeningProfileId) => {
      await api.deleteScreeningProfile({ screeningProfileId });
    },
    onSuccess: () => {
      message.success('Screening profile deleted successfully');
      queryResult.refetch();
      setDeleting(false);
    },
    onError: (error) => {
      message.error(getErrorMessage(error) || `Failed to delete screening profile`);
      setDeleting(false);
    },
  });

  const duplicateScreeningProfileMutation = useMutation<void, Error, ScreeningProfileResponse>({
    mutationFn: async (item) => {
      await api.postScreeningProfiles({
        ScreeningProfileRequest: {
          screeningProfileName: `${item.screeningProfileName} (Copy)`,
          screeningProfileDescription: item.screeningProfileDescription || '',
          screeningProfileStatus: item.screeningProfileStatus || 'DISABLED',
          isDefault: false,
          sanctions: item.sanctions,
          pep: item.pep,
          rel: item.rel,
          adverseMedia: item.adverseMedia,
        },
      });
    },
    onSuccess: () => {
      message.success('Screening profile duplicated successfully');
      queryResult.refetch();
    },
    onError: (error) => {
      message.error(getErrorMessage(error) || `Failed to duplicate screening profile`);
    },
  });

  const columns = useMemo<TableColumn<ScreeningProfileResponse>[]>(() => {
    const helper = new ColumnHelper<ScreeningProfileResponse>();
    return [
      helper.simple<'screeningProfileId'>({
        title: 'ID',
        key: 'screeningProfileId',
        defaultWidth: 100,
        type: {
          render: (value, { item }) => (
            <div className={s.idContainer}>
              <Id onClick={() => setEditingProfile(item)}>{value}</Id>
              {item.isDefault && (
                <Tag color="gray" className="ml-2">
                  Default
                </Tag>
              )}
            </div>
          ),
        },
      }),
      helper.simple<'screeningProfileName'>({
        title: 'Screening profile name',
        key: 'screeningProfileName',
        type: STRING,
        defaultWidth: 180,
      }),
      helper.simple<'screeningProfileDescription'>({
        title: 'Screening profile description',
        key: 'screeningProfileDescription',
        type: STRING,
        defaultWidth: 240,
      }),
      helper.simple<'updatedAt'>({
        title: 'Last updated at',
        key: 'updatedAt',
        type: DATE,
        sorting: 'desc',
      }),
      helper.simple<'createdBy'>({
        title: 'Created by',
        key: 'createdBy',
        defaultWidth: 300,
        enableResizing: false,
        type: {
          stringify: (value) => {
            return `${value === undefined ? '' : users[value]?.name ?? value}`;
          },
          render: (userId, _) => {
            return userId ? <AccountTag accountId={userId} /> : <>-</>;
          },
        },
      }),
      helper.simple<'screeningProfileStatus'>({
        title: 'Status',
        key: 'screeningProfileStatus',
        type: {
          render: (value, { item }) => (
            <div className={s.statusContainer}>
              <Toggle
                value={value === 'ENABLED'}
                isDisabled={isReadOnly || updateStatusMutation.isLoading}
                onChange={(checked) => {
                  updateStatusMutation.mutate({
                    screeningProfileId: item.screeningProfileId || '',
                    status: checked ? 'ENABLED' : 'DISABLED',
                    item,
                  });
                }}
              />
            </div>
          ),
        },
        defaultWidth: 100,
      }),
      helper.display({
        title: 'Actions',
        defaultWidth: 150,
        render: (item: ScreeningProfileResponse) => (
          <div className={s.actions}>
            <Tooltip title="Edit">
              <EditOutlined
                onClick={() => {
                  setEditingProfile(item);
                }}
              />
            </Tooltip>
            <Tooltip title="Duplicate">
              <CopyOutlined onClick={() => duplicateScreeningProfileMutation.mutate(item)} />
            </Tooltip>
            <Tooltip title="Delete">
              <Confirm
                title={`Delete screening profile`}
                text={`Are you sure you want to delete the screening profile "${item.screeningProfileName}"? This action cannot be undone.`}
                onConfirm={() => {
                  if (item.screeningProfileId && !deleting) {
                    setDeleting(true);
                    deleteScreeningProfileMutation.mutate(item.screeningProfileId);
                  }
                }}
              >
                {({ onClick }) => <DeleteOutlined onClick={onClick} />}
              </Confirm>
            </Tooltip>
          </div>
        ),
      }),
    ];
  }, [
    users,
    isReadOnly,
    updateStatusMutation,
    duplicateScreeningProfileMutation,
    deleting,
    deleteScreeningProfileMutation,
  ]);

  if (!hasFeature) {
    return null;
  }

  return (
    <SettingsCard
      title="Screening profiles"
      minRequiredResources={['read:::settings/screening/screening-profiles/*']}
    >
      <div className={s.sanctionsSettingsRoot}>
        <QueryResultsTable<ScreeningProfileResponse>
          queryResults={queryResult}
          rowKey="screeningProfileId"
          externalHeader
          extraTools={[() => <CreateScreeningProfileModal />]}
          toolsOptions={{
            reload: false,
            setting: false,
            download: false,
          }}
          columns={columns}
        />
        {editingProfile && (
          <CreateScreeningProfileModal
            isOpen={true}
            onClose={() => setEditingProfile(undefined)}
            initialValues={editingProfile}
          />
        )}
      </div>
    </SettingsCard>
  );
};
