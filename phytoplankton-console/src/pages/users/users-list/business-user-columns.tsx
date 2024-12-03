import React from 'react';
import { capitalizeWords } from '@flagright/lib/utils/humanize';
import { BusinessUserTableItem } from '@/apis';
import { TableColumn } from '@/components/library/Table/types';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { DATE, MONEY, TAGS } from '@/components/library/Table/standardDataTypes';
import Id from '@/components/ui/Id';
import { getUserLink } from '@/utils/api/users';
import Tag from '@/components/library/Tag';

export function getBusinessUserColumns(): TableColumn<BusinessUserTableItem>[] {
  const helper = new ColumnHelper<BusinessUserTableItem>();

  return [
    helper.simple<'userId'>({
      title: 'User ID',
      key: 'userId',
      tooltip: 'Unique identification of user.',
      type: {
        render: (userId, { item: entity }) => {
          return (
            <Id to={getUserLink(entity)} testName="business-user-id">
              {userId}
            </Id>
          );
        },
        link(value, item) {
          return getUserLink(item) ?? '#';
        },
      },
    }),
    helper.simple<'name'>({
      title: 'Legal name',
      key: 'name',
    }),
    helper.simple<'industry'>({
      title: 'Industry',
      key: 'industry',
      type: {
        render: (businessIndustry) => {
          return (
            <div>
              {businessIndustry
                ? businessIndustry.map((industry) => <Tag key={industry}>{industry}</Tag>)
                : '-'}
            </div>
          );
        },
      },
    }),
    helper.simple<'userRegistrationStatus'>({
      title: 'User registration status',
      key: 'userRegistrationStatus',
      type: {
        render: (status) => {
          return (
            <div>
              {status ? (
                <Tag color={status === 'REGISTERED' ? 'green' : 'red'}>
                  {capitalizeWords(status)}
                </Tag>
              ) : (
                '-'
              )}
            </div>
          );
        },
      },
    }),
    helper.simple<'expectedVolumes.transactionVolumePerMonth'>({
      title: 'Expected total transaction volume per month',
      key: 'expectedVolumes.transactionVolumePerMonth',
      type: MONEY,
      defaultWidth: 200,
    }),
    helper.simple<'expectedVolumes.expectedTransactionAmountPerMonth'>({
      title: 'Expected turnover amount per month',
      key: 'expectedVolumes.expectedTransactionAmountPerMonth',
      type: MONEY,
    }),
    helper.simple<'expectedVolumes.maximumDailyTransactionLimit'>({
      title: 'Maximum daily transaction limit',
      key: 'expectedVolumes.maximumDailyTransactionLimit',
      type: MONEY,
    }),
    helper.simple<'registrationIdentifier'>({
      title: 'Registration identifier',
      key: 'registrationIdentifier',
    }),
    helper.simple<'registrationCountry'>({
      title: 'Registration country',
      key: 'registrationCountry',
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
  ];
}
