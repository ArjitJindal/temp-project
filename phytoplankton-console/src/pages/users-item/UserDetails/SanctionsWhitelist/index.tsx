import React from 'react';
import * as Card from '@/components/ui/Card';
import { UI_SETTINGS } from '@/pages/users-item/ui-settings';
import DeleteIcon from '@/components/ui/icons/Remix/system/delete-bin-7-line.react.svg';
import { SanctionsWhitelistEntity, InternalBusinessUser, InternalConsumerUser } from '@/apis';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { useApi } from '@/api';
import { SANCTIONS_WHITELIST_SEARCH } from '@/utils/queries/keys';
import { useQuery } from '@/utils/queries/hooks';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import { ID, DATE_TIME } from '@/components/library/Table/standardDataTypes';
import Button from '@/components/library/Button';
import { useMutation } from '@/utils/queries/mutations/hooks';
import { useHasPermissions } from '@/utils/user-utils';
import Confirm from '@/components/utils/Confirm';
import { isLoading } from '@/utils/asyncResource';
import { message } from '@/components/library/Message';
import { getErrorMessage } from '@/utils/lang';

interface Props {
  user: InternalConsumerUser | InternalBusinessUser;
  uiSettings: typeof UI_SETTINGS;
}

export default function SanctionsWhitelist(props: Props) {
  const { user, uiSettings } = props;

  const api = useApi();

  const queryResult = useQuery(SANCTIONS_WHITELIST_SEARCH({ userId: user.userId }), async () => {
    return api.searchSanctionsWhitelist({ filterUserId: [user.userId] });
  });

  const deleteMutation = useMutation<unknown, unknown, { userId: string; id: string }>(
    async (variables) => {
      await api.deleteSanctionsWhitelistRecord({
        userId: variables.userId,
        caEntityId: variables.id,
      });
    },
    {
      onSuccess: () => {
        message.success('Record deleted');
        queryResult.refetch();
      },
      onError: (e) => {
        message.fatal(`Failed to delete record: ${getErrorMessage(e)}`, e);
      },
    },
  );

  const hasWritePermissions = useHasPermissions(['sanctions:search:write']);
  const helper = new ColumnHelper<SanctionsWhitelistEntity>();
  return (
    <Card.Root
      header={{
        title: uiSettings.cards.USER_DETAILS.title,
      }}
    >
      <Card.Section>
        <QueryResultsTable
          rowKey="createdAt"
          queryResults={queryResult}
          toolsOptions={false}
          columns={[
            helper.simple<'caEntity.id'>({
              title: 'Id',
              key: 'caEntity.id',
              type: ID,
            }),
            helper.simple<'caEntity.name'>({
              title: 'Name',
              key: 'caEntity.name',
            }),
            helper.simple<'reason'>({
              title: 'Reason',
              key: 'reason',
            }),
            helper.simple<'comment'>({
              title: 'Comment',
              key: 'comment',
            }),
            helper.simple<'createdAt'>({
              title: 'Timestamp',
              key: 'createdAt',
              type: DATE_TIME,
            }),
            helper.display({
              title: 'Actions',
              defaultWidth: 120,
              render: (entity) => {
                return (
                  <Confirm
                    title={`Are you sure you want to delete this record?`}
                    text="After you delete this record you could have this entity hit for this user again"
                    onConfirm={() => {
                      if (entity.caEntity.id != null) {
                        deleteMutation.mutate({ userId: user.userId, id: entity.caEntity.id });
                      }
                    }}
                    res={deleteMutation.dataResource}
                  >
                    {({ onClick }) => (
                      <Button
                        type="SECONDARY"
                        icon={<DeleteIcon />}
                        onClick={onClick}
                        isDisabled={!hasWritePermissions}
                        isLoading={isLoading(deleteMutation.dataResource)}
                      >
                        Delete
                      </Button>
                    )}
                  </Confirm>
                );
              },
            }),
          ]}
        />
      </Card.Section>
    </Card.Root>
  );
}
