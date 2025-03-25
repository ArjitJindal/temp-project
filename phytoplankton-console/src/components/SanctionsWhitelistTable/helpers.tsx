import React, { useMemo } from 'react';
import { humanizeConstant, firstLetterUpper } from '@flagright/lib/utils/humanize';
import { Mutation } from '@/utils/queries/types';
import { TableColumn } from '@/components/library/Table/types';
import {
  SanctionsDetailsEntityType,
  SanctionsScreeningEntity,
  SanctionsWhitelistEntity,
} from '@/apis';
import { useHasPermissions } from '@/utils/user-utils';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import {
  DATE_TIME,
  ENUM,
  SANCTIONS_CLEAR_REASON,
  STRING,
} from '@/components/library/Table/standardDataTypes';
import Tag from '@/components/library/Tag';
import Confirm from '@/components/utils/Confirm';
import Button from '@/components/library/Button';
import DeleteIcon from '@/components/ui/icons/Remix/system/delete-bin-7-line.react.svg';
import { isLoading } from '@/utils/asyncResource';
import { notEmpty } from '@/utils/array';
import { ExtraFilterProps } from '@/components/library/Filter/types';
import UserSearchButton from '@/pages/transactions/components/UserSearchButton';
import Id from '@/components/ui/Id';
import { makeUrl } from '@/utils/routing';
import { StatePair } from '@/utils/state';
import ListQuickFilter from '@/components/library/QuickFilter/subtypes/ListQuickFilter';
import { Option } from '@/components/library/Select';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';

const DERIVED_ENTITY_TYPE_VALUES = [
  'CONSUMER_USER',
  'BANK_NAME',
  'IBAN',
  'EXTERNAL_USER',
  'SHAREHOLDER',
  'LEGAL_NAME',
  'DIRECTOR',
  'NAME_ON_CARD',
  'NAME_ON_CHECK',
] as const;

export type DerivedEntityTypeValue = typeof DERIVED_ENTITY_TYPE_VALUES[number];

const DERIVED_ENTITY_TYPE_OPTIONS: Option<DerivedEntityTypeValue>[] =
  DERIVED_ENTITY_TYPE_VALUES.map((value) => ({ value, label: humanizeConstant(value) }));

export interface SanctionsWhitelistTableParams {
  userId?: string;
  entity?: SanctionsScreeningEntity;
  entityType?: SanctionsDetailsEntityType;
}

const ENTITY_TYPE_ADAPTER = {
  serializer: (value: DerivedEntityTypeValue | undefined): SanctionsWhitelistTableParams => {
    let entity: SanctionsScreeningEntity | undefined;
    let entityType: SanctionsDetailsEntityType | undefined;
    if (value === 'CONSUMER_USER') {
      entityType = 'CONSUMER_NAME';
    } else if (value === 'BANK_NAME') {
      entityType = 'BANK_NAME';
    } else if (value === 'IBAN') {
      entity = 'IBAN';
    } else if (value === 'EXTERNAL_USER') {
      entity = 'EXTERNAL_USER';
    } else if (value === 'SHAREHOLDER') {
      entityType = 'SHAREHOLDER';
    } else if (value === 'LEGAL_NAME') {
      entityType = 'LEGAL_NAME';
    } else if (value === 'DIRECTOR') {
      entityType = 'DIRECTOR';
    } else if (value === 'NAME_ON_CARD') {
      entityType = 'NAME_ON_CARD';
    } else if (value === 'NAME_ON_CHECK') {
      entityType = 'PAYMENT_NAME';
    }
    return {
      entity,
      entityType,
    };
  },
  deserializer: (value: SanctionsWhitelistTableParams): DerivedEntityTypeValue | undefined => {
    if (value.entity === 'IBAN') {
      return 'IBAN';
    } else if (value.entity === 'EXTERNAL_USER') {
      return 'EXTERNAL_USER';
    }
    if (value.entityType === 'CONSUMER_NAME') {
      return 'CONSUMER_USER';
    }
    if (value.entityType === 'BANK_NAME') {
      return 'BANK_NAME';
    }
    if (value.entityType === 'SHAREHOLDER') {
      return 'SHAREHOLDER';
    }
    if (value.entityType === 'LEGAL_NAME') {
      return 'LEGAL_NAME';
    }
    if (value.entityType === 'DIRECTOR') {
      return 'DIRECTOR';
    }
    if (value.entityType === 'NAME_ON_CARD') {
      return 'NAME_ON_CARD';
    }
    if (value.entityType === 'PAYMENT_NAME') {
      return 'NAME_ON_CHECK';
    }
    return undefined;
  },
};

export function useExtraFilters(singleUserMode: boolean) {
  const settings = useSettings();
  return useMemo(
    (): ExtraFilterProps<SanctionsWhitelistTableParams>[] =>
      [
        !singleUserMode && {
          key: 'userId',
          title: `${firstLetterUpper(settings.userAlias)} ID/Name`,
          showFilterByDefault: true,
          renderer: ({ params, setParams }) => (
            <UserSearchButton
              userId={params.userId ?? null}
              onConfirm={(userId) => {
                setParams((state) => ({
                  ...state,
                  userId: userId ?? undefined,
                }));
              }}
            />
          ),
        },
        {
          key: '_entityType',
          title: 'Entity type',
          showFilterByDefault: true,
          renderer: ({ params, setParams }) => (
            <ListQuickFilter<DerivedEntityTypeValue>
              title={'Entity type'}
              value={ENTITY_TYPE_ADAPTER.deserializer(params)}
              onChange={(value) => {
                setParams((paramsState) => ({
                  ...paramsState,
                  ...ENTITY_TYPE_ADAPTER.serializer(value),
                }));
              }}
              options={DERIVED_ENTITY_TYPE_OPTIONS}
              mode={'SINGLE'}
            />
          ),
        },
      ].filter(notEmpty),
    [singleUserMode, settings.userAlias],
  );
}

export function useColumns(
  singleUserMode: boolean,
  deleteMutation: Mutation<unknown, unknown, { ids: string[] }>,
  selectedState: StatePair<SanctionsWhitelistEntity | undefined>,
): TableColumn<SanctionsWhitelistEntity>[] {
  const hasWritePermissions = useHasPermissions(['sanctions:search:write']);
  const settings = useSettings();
  return useMemo(() => {
    const [_, setSelected] = selectedState;
    const helper = new ColumnHelper<SanctionsWhitelistEntity>();

    const columns: TableColumn<SanctionsWhitelistEntity>[] = [
      !singleUserMode &&
        helper.simple<'userId'>({
          title: `${firstLetterUpper(settings.userAlias)} / Payment details identifier`,
          key: 'userId',
          type: {
            render: (value, { item }) => {
              if (item.entity === 'EXTERNAL_USER') {
                return <span>{value}</span>;
              }
              return <Id to={makeUrl('/users/list/all/:userId', { userId: value })}>{value}</Id>;
            },
          },
        }),
      helper.simple<'sanctionsEntity.name'>({
        title: 'Name',
        key: 'sanctionsEntity.name',
        type: {
          ...STRING,
          render: (value, context) => {
            return (
              <>
                <Id onClick={() => setSelected(context.item)}>{value}</Id>
              </>
            );
          },
        },
      }),
      helper.derived({
        title: 'Entity type',
        value: (value) => ENTITY_TYPE_ADAPTER.deserializer(value as SanctionsWhitelistTableParams),
        type: ENUM,
      }),
      helper.simple<'searchTerm'>({
        title: 'Entity',
        key: 'searchTerm',
        type: {
          ...STRING,
          render: (searchTerm) => {
            if (searchTerm == null) {
              return <Tag>Any</Tag>;
            }
            return <span>{searchTerm}</span>;
          },
        },
      }),
      helper.simple<'reason'>({
        title: 'Reason',
        key: 'reason',
        type: SANCTIONS_CLEAR_REASON,
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
              title={`Are you sure you want to remove this hit from whitelist?`}
              text="Please note that after removing this hit would allow it to be re-hit for the next screening alert"
              onConfirm={() => {
                deleteMutation.mutate({ ids: [entity.sanctionsWhitelistId] });
              }}
              res={deleteMutation.dataResource}
            >
              {({ onClick }) => (
                <Button
                  type="DANGER"
                  icon={<DeleteIcon />}
                  onClick={onClick}
                  isDisabled={!hasWritePermissions}
                  isLoading={isLoading(deleteMutation.dataResource)}
                >
                  Remove
                </Button>
              )}
            </Confirm>
          );
        },
      }),
    ].filter(notEmpty);

    return columns;
  }, [singleUserMode, deleteMutation, hasWritePermissions, selectedState, settings.userAlias]);
}
