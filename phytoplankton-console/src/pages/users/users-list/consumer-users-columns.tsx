import React from 'react';
import { firstLetterUpper, humanizeConstant } from '@flagright/lib/utils/humanize';
import s from './styles.module.less';
import { dayjs, DEFAULT_DATE_FORMAT } from '@/utils/dayjs';
import { TableColumn } from '@/components/library/Table/types';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import {
  COUNTRY,
  DATE,
  TAGS,
  USER_KYC_STATUS_TAG,
  USER_STATE_TAG,
} from '@/components/library/Table/standardDataTypes';
import { getUserLink } from '@/utils/api/users';
import Id from '@/components/ui/Id';
import CountryDisplay from '@/components/ui/CountryDisplay';
import PendingApprovalTag from '@/components/library/Tag/PendingApprovalTag';
import { ConsumerUserTableItem } from '@/pages/users/users-list/data';

export function getConsumerUserColumns(userAlias?: string): TableColumn<ConsumerUserTableItem>[] {
  const helper = new ColumnHelper<ConsumerUserTableItem>();

  return helper.list([
    helper.simple<'userId'>({
      title: `${firstLetterUpper(userAlias)} ID`,
      key: 'userId',
      tooltip: `Unique identification of ${userAlias}.`,
      type: {
        render: (userId, { item: entity }) => {
          return (
            <div className={s.idWrapper}>
              <Id to={getUserLink(entity)} testName="consumer-user-id">
                {userId}
              </Id>
              {!!entity.proposals?.length && <PendingApprovalTag />}
            </div>
          );
        },
        link(value, item) {
          return getUserLink(item) ?? '#';
        },
      },
    }),
    helper.simple<'name'>({
      title: 'Name',
      key: 'name',
      type: {
        render: (name) => <>{name}</>,
        stringify: (name) => name ?? '',
      },
    }),
    helper.simple<'dateOfBirth'>({
      title: 'Date of birth',
      key: 'dateOfBirth',
      type: {
        render: (dateOfBirth) => {
          return <>{dateOfBirth ? dayjs(dateOfBirth).format(DEFAULT_DATE_FORMAT) : ''}</>;
        },
      },
    }),
    helper.simple<'countryOfResidence'>({
      title: 'Country of residence',
      key: 'countryOfResidence',
      type: COUNTRY,
      filtering: true,
    }),
    helper.simple<'countryOfNationality'>({
      title: 'Country of nationality',
      key: 'countryOfNationality',
      type: COUNTRY,
      filtering: true,
    }),
    helper.simple<'kycStatus'>({
      title: 'KYC status',
      id: 'kycStatus',
      type: USER_KYC_STATUS_TAG,
      key: 'kycStatus',
      tooltip: `KYC status of ${userAlias}.`,
    }),

    helper.simple<'kycStatusReason'>({
      title: 'KYC status reason',
      key: 'kycStatusReason',
      defaultVisibility: false,
    }),
    helper.simple<'userState'>({
      title: `${firstLetterUpper(userAlias)} status`,
      type: USER_STATE_TAG,
      key: 'userState',
      id: 'userStatus',
      tooltip: `Status of ${userAlias}.`,
    }),
    helper.simple<'userStateReason'>({
      title: `${firstLetterUpper(userAlias)} status reason`,
      key: 'userStateReason',
      defaultVisibility: false,
    }),
    helper.simple<'pepDetails'>({
      title: 'PEP status',
      key: 'pepDetails',
      type: {
        render: (pepStatus) => <>{pepStatus?.some((status) => status.isPepHit) ? 'Yes' : 'No'}</>,
      },
      filtering: false,
    }),
    helper.derived({
      title: 'PEP hit status details',
      value: (item) => item?.pepDetails,
      id: 'pep-details',
      exporting: false,
      type: {
        render: (value): JSX.Element => {
          return (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {value
                ?.filter((part) => part.isPepHit)
                .map((part, index) => (
                  <div style={{ display: 'flex', flexDirection: 'row' }} key={index}>
                    {part.pepCountry && <CountryDisplay isoCode={part.pepCountry} />}
                    {part.pepRank && part.pepCountry ? <>{','}&nbsp;</> : ''}
                    {part.pepRank && humanizeConstant(part.pepRank)}
                  </div>
                ))}
            </div>
          );
        },
        defaultWrapMode: 'WRAP',
      },
      tooltip: 'Only details where PEP is hit are displayed',
      defaultWidth: 300,
    }),
    helper.simple<'tags'>({
      title: 'Tags',
      key: 'tags',
      type: TAGS,
    }),
    helper.simple<'createdTimestamp'>({
      title: 'Created at',
      key: 'createdTimestamp',
      type: DATE,
      sorting: true,
      filtering: true,
    }),
  ]);
}
