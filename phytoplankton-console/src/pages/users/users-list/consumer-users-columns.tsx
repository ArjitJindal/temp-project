import React from 'react';
import { dayjs, DEFAULT_DATE_FORMAT } from '@/utils/dayjs';
import { InternalConsumerUser } from '@/apis';
import { TableColumn } from '@/components/library/Table/types';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { COUNTRY, DATE, TAGS } from '@/components/library/Table/standardDataTypes';
import { getFullName, getUserLink } from '@/utils/api/users';
import Id from '@/components/ui/Id';

export function getConsumerUserColumns(): TableColumn<InternalConsumerUser>[] {
  const helper = new ColumnHelper<InternalConsumerUser>();

  return [
    helper.simple<'userId'>({
      title: 'User ID',
      key: 'userId',
      tooltip: 'Unique identification of user.',
      type: {
        render: (userId, { item: entity }) => {
          return (
            <Id to={getUserLink(entity)} testName="consumer-user-id">
              {userId}
            </Id>
          );
        },
        link(value, item) {
          return getUserLink(item) ?? '#';
        },
      },
    }),
    helper.simple<'userDetails'>({
      title: 'Name',
      key: 'userDetails',
      type: {
        render: (userDetails) => <>{getFullName(userDetails)}</>,
        stringify: (userDetails) => getFullName(userDetails),
      },
    }),
    helper.simple<'userDetails.dateOfBirth'>({
      title: 'Date of birth',
      key: 'userDetails.dateOfBirth',
      type: {
        render: (dateOfBirth) => {
          return <>{dateOfBirth ? dayjs(dateOfBirth).format(DEFAULT_DATE_FORMAT) : ''}</>;
        },
      },
    }),
    helper.simple<'userDetails.countryOfResidence'>({
      title: 'Country of residence',
      key: 'userDetails.countryOfResidence',
      type: COUNTRY,
    }),
    helper.simple<'userDetails.countryOfNationality'>({
      title: 'Country of nationality',
      key: 'userDetails.countryOfNationality',
      type: COUNTRY,
    }),
    helper.simple<'kycStatusDetails.status'>({
      title: 'KYC status',
      key: 'kycStatusDetails.status',
    }),
    helper.simple<'kycStatusDetails.reason'>({
      title: 'KYC status reason',
      key: 'kycStatusDetails.reason',
    }),
    helper.simple<'userStateDetails.state'>({
      title: 'User state',
      key: 'userStateDetails.state',
    }),
    helper.simple<'pepStatus'>({
      title: 'PEP status',
      key: 'pepStatus',
      type: {
        render: (pepStatus) => <>{pepStatus?.some((status) => status.isPepHit) ? 'Yes' : 'No'}</>,
      },
      filtering: false,
    }),
    helper.simple<'tags'>({
      title: 'Tags',
      key: 'tags',
      type: TAGS,
    }),
    helper.simple<'createdTimestamp'>({
      title: 'Created at',
      key: 'createdTimestamp',
      type: {
        ...DATE,
        autoFilterDataType: {
          kind: 'dateTimeRange',
          allowClear: false,
        },
      },
      sorting: true,
      filtering: true,
    }),
  ];
}
