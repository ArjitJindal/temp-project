import React from 'react';
import { capitalizeWords } from '@flagright/lib/utils/humanize';
import { InternalBusinessUser } from '@/apis';
import { TableColumn } from '@/components/library/Table/types';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { DATE, MONEY, TAGS } from '@/components/library/Table/standardDataTypes';
import Id from '@/components/ui/Id';
import { getUserLink } from '@/utils/api/users';
import Tag from '@/components/library/Tag';

export function getBusinessUserColumns(): TableColumn<InternalBusinessUser>[] {
  const helper = new ColumnHelper<InternalBusinessUser>();

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
    helper.simple<'legalEntity.companyGeneralDetails.legalName'>({
      title: 'Legal name',
      key: 'legalEntity.companyGeneralDetails.legalName',
    }),
    helper.simple<'legalEntity.companyGeneralDetails.businessIndustry'>({
      title: 'Industry',
      key: 'legalEntity.companyGeneralDetails.businessIndustry',
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
    helper.simple<'legalEntity.companyGeneralDetails.userRegistrationStatus'>({
      title: 'User registration status',
      key: 'legalEntity.companyGeneralDetails.userRegistrationStatus',
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
    helper.simple<'legalEntity.companyFinancialDetails.expectedTransactionAmountPerMonth'>({
      title: 'Expected total transaction volume per month',
      key: 'legalEntity.companyFinancialDetails.expectedTransactionAmountPerMonth',
      type: MONEY,
      defaultWidth: 200,
    }),
    helper.simple<'legalEntity.companyFinancialDetails.expectedTurnoverPerMonth'>({
      title: 'Expected turnover amount per month',
      key: 'legalEntity.companyFinancialDetails.expectedTurnoverPerMonth',
      type: MONEY,
    }),
    helper.simple<'transactionLimits.maximumDailyTransactionLimit'>({
      title: 'Maximum daily transaction limit',
      key: 'transactionLimits.maximumDailyTransactionLimit',
      type: MONEY,
    }),
    helper.simple<'legalEntity.companyRegistrationDetails.registrationIdentifier'>({
      title: 'Registration identifier',
      key: 'legalEntity.companyRegistrationDetails.registrationIdentifier',
    }),
    helper.simple<'legalEntity.companyRegistrationDetails.registrationCountry'>({
      title: 'Registration country',
      key: 'legalEntity.companyRegistrationDetails.registrationCountry',
    }),
    helper.simple<'tags'>({
      title: 'Tags',
      key: 'tags',
      type: TAGS,
    }),
    helper.simple<'createdTimestamp'>({
      title: 'Created at',
      type: DATE,
      key: 'createdTimestamp',
      sorting: true,
      filtering: true,
    }),
  ];
}
