import { useMemo, useState } from 'react';
import { EditOutlined, CopyOutlined, DeleteOutlined } from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import s from './styles.module.less';
import CreateSearchProfileModal from './CreateSearchProfileModal';
import Tooltip from '@/components/library/Tooltip';
import Toggle from '@/components/library/Toggle';
import { useQuery } from '@/utils/queries/hooks';
import { useApi } from '@/api';
import { SearchProfileResponse } from '@/apis';
import { SEARCH_PROFILES } from '@/utils/queries/keys';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import { TableColumn } from '@/components/library/Table/types';
import { useHasResources } from '@/utils/user-utils';
import { useUsers } from '@/utils/api/auth';
import Tag from '@/components/library/Tag';
import SettingsCard from '@/components/library/SettingsCard';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { STRING, DATE } from '@/components/library/Table/standardDataTypes';
import Id from '@/components/ui/Id';
import { ConsoleUserAvatar } from '@/pages/case-management/components/ConsoleUserAvatar';
import { message } from '@/components/library/Message';
import Confirm from '@/components/utils/Confirm';

export const SearchProfileList = ({ hasFeature }) => {
  const api = useApi();
  const { users, isLoading } = useUsers({ includeRootUsers: true, includeBlockedUsers: true });
  const [deleting, setDeleting] = useState(false);
  const [editingProfile, setEditingProfile] = useState<SearchProfileResponse | undefined>(
    undefined,
  );

  const queryResult = useQuery(SEARCH_PROFILES(), async () => {
    try {
      const response = await api.getSearchProfiles();
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

  const isReadOnly = !useHasResources(['write:::screening/search-profiles/*']);

  const updateStatusMutation = useMutation<
    void,
    Error,
    {
      searchProfileId: string;
      status: 'ENABLED' | 'DISABLED';
      item: SearchProfileResponse;
    }
  >({
    mutationFn: async ({ searchProfileId, status, item }) => {
      await api.updateSearchProfile({
        searchProfileId,
        SearchProfileRequest: {
          searchProfileName: item.searchProfileName || '',
          searchProfileDescription: item.searchProfileDescription || '',
          searchProfileStatus: status,
          isDefault: item.isDefault || false,
        },
      });
    },
    onSuccess: () => {
      message.success('Search profile status updated successfully');
      queryResult.refetch();
    },
    onError: (error) => {
      message.error(`Failed to update search profile status: ${error.message}`);
    },
  });

  const deleteSearchProfileMutation = useMutation<void, Error, string>({
    mutationFn: async (searchProfileId) => {
      await api.deleteSearchProfile({ searchProfileId });
    },
    onSuccess: () => {
      message.success('Search profile deleted successfully');
      queryResult.refetch();
      setDeleting(false);
    },
    onError: (error) => {
      message.error(`Failed to delete search profile: ${error.message}`);
      setDeleting(false);
    },
  });

  const duplicateSearchProfileMutation = useMutation<void, Error, SearchProfileResponse>({
    mutationFn: async (item) => {
      await api.postSearchProfiles({
        SearchProfileRequest: {
          searchProfileName: `${item.searchProfileName} (Copy)`,
          searchProfileDescription: item.searchProfileDescription || '',
          searchProfileStatus: item.searchProfileStatus || 'DISABLED',
          isDefault: false,
          nationality: item.nationality || [],
          types: item.types || [],
          fuzziness: item.fuzziness,
        },
      });
    },
    onSuccess: () => {
      message.success('Search profile duplicated successfully');
      queryResult.refetch();
    },
    onError: (error) => {
      message.error(`Failed to duplicate search profile: ${error.message}`);
    },
  });

  const columns = useMemo<TableColumn<SearchProfileResponse>[]>(() => {
    const helper = new ColumnHelper<SearchProfileResponse>();
    return [
      helper.simple<'searchProfileId'>({
        title: 'ID',
        key: 'searchProfileId',
        defaultWidth: 100,
        type: {
          render: (value, { item }) => (
            <div className={s.idContainer}>
              <Id to="/settings/sanctions/#">{value}</Id>
              {item.isDefault && (
                <Tag color="gray" className="ml-2">
                  Default
                </Tag>
              )}
            </div>
          ),
        },
      }),
      helper.simple<'searchProfileName'>({
        title: 'Search profile name',
        key: 'searchProfileName',
        type: STRING,
        defaultWidth: 180,
      }),
      helper.simple<'searchProfileDescription'>({
        title: 'Search profile description',
        key: 'searchProfileDescription',
        type: STRING,
        defaultWidth: 200,
      }),
      helper.simple<'createdAt'>({
        title: 'Created at',
        key: 'createdAt',
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
            return userId ? (
              <ConsoleUserAvatar userId={userId} users={users} loadingUsers={isLoading} />
            ) : (
              <>-</>
            );
          },
        },
      }),
      helper.simple<'searchProfileStatus'>({
        title: 'Status',
        key: 'searchProfileStatus',
        type: {
          render: (value, { item }) => (
            <div className={s.statusContainer}>
              <Toggle
                value={value === 'ENABLED'}
                isDisabled={isReadOnly || updateStatusMutation.isLoading}
                onChange={(checked) => {
                  updateStatusMutation.mutate({
                    searchProfileId: item.searchProfileId || '',
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
        render: (item: SearchProfileResponse) => (
          <div className={s.actions}>
            <Tooltip title="Edit">
              <EditOutlined
                onClick={() => {
                  setEditingProfile(item);
                }}
              />
            </Tooltip>
            <Tooltip title="Duplicate">
              <CopyOutlined onClick={() => duplicateSearchProfileMutation.mutate(item)} />
            </Tooltip>
            <Tooltip title="Delete">
              <Confirm
                title={`Delete search profile`}
                text={`Are you sure you want to delete the search profile "${item.searchProfileName}"? This action cannot be undone.`}
                onConfirm={() => {
                  if (item.searchProfileId && !deleting) {
                    setDeleting(true);
                    deleteSearchProfileMutation.mutate(item.searchProfileId);
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
    isLoading,
    users,
    isReadOnly,
    updateStatusMutation,
    deleting,
    deleteSearchProfileMutation,
    duplicateSearchProfileMutation,
  ]);

  if (!hasFeature) {
    return null;
  }

  return (
    <SettingsCard
      title="Search profiles"
      minRequiredResources={['read:::settings/screening/search-profiles/*']}
    >
      <div className={s.sanctionsSettingsRoot}>
        <QueryResultsTable<SearchProfileResponse>
          queryResults={queryResult}
          rowKey="searchProfileId"
          externalHeader
          extraTools={[() => <CreateSearchProfileModal />]}
          toolsOptions={{
            reload: false,
            setting: false,
            download: false,
          }}
          columns={columns}
        />
        {editingProfile && (
          <CreateSearchProfileModal
            isOpen={true}
            onClose={() => setEditingProfile(undefined)}
            onSave={async (values) => {
              try {
                await api.updateSearchProfile({
                  searchProfileId: editingProfile.searchProfileId || '',
                  SearchProfileRequest: {
                    ...values,
                  },
                });
                message.success('Search profile updated successfully');
                queryResult.refetch();
                setEditingProfile(undefined);
              } catch (error) {
                message.error(
                  `Failed to update search profile: ${
                    error instanceof Error ? error.message : 'Unknown error'
                  }`,
                );
              }
            }}
            initialValues={editingProfile}
          />
        )}
      </div>
    </SettingsCard>
  );
};

export default SearchProfileList;
