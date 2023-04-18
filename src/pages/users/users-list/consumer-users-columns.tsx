import { Link } from 'react-router-dom';
import React from 'react';
import { dayjs, DEFAULT_DATE_FORMAT } from '@/utils/dayjs';
import { InternalConsumerUser } from '@/apis';
import { TableColumn } from '@/components/ui/Table/types';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { COUNTRY, DATE, TAGS } from '@/components/library/Table/standardDataTypes';
import { getFullName } from '@/utils/api/users';

export function getConsumerUserColumns(): TableColumn<InternalConsumerUser>[] {
  const helper = new ColumnHelper<InternalConsumerUser>();

  return [
    helper.simple<'userId'>({
      title: 'User ID',
      key: 'userId',
      tooltip: 'Unique identification of user.',
      type: {
        render: (userId) => {
          return (
            <Link to={`/users/list/consumer/${userId}`} replace>
              {userId}
            </Link>
          );
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
    helper.simple<'tags'>({
      title: 'Tags',
      key: 'tags',
      type: TAGS,
    }),
    helper.simple<'createdTimestamp'>({
      title: 'Created on',
      key: 'createdTimestamp',
      type: DATE,
    }),
  ];
}
