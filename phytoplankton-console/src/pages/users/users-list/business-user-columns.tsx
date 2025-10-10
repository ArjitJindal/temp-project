import { capitalizeWords, firstLetterUpper } from '@flagright/lib/utils/humanize';
import s from './styles.module.less';
import { TableColumn } from '@/components/library/Table/types';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import {
  DATE,
  MONEY,
  TAGS,
  USER_KYC_STATUS_TAG,
  USER_STATE_TAG,
} from '@/components/library/Table/standardDataTypes';
import Id from '@/components/ui/Id';
import { getUserLink } from '@/utils/api/users';
import Tag from '@/components/library/Tag';
import PendingApprovalTag from '@/components/library/Tag/PendingApprovalTag';
import { BusinessUserTableItem } from '@/pages/users/users-list/data';

export function getBusinessUserColumns(userAlias?: string): TableColumn<BusinessUserTableItem>[] {
  const helper = new ColumnHelper<BusinessUserTableItem>();

  return [
    helper.simple<'userId'>({
      title: `${firstLetterUpper(userAlias)} ID`,
      key: 'userId',
      tooltip: `Unique identification of ${userAlias}.`,
      type: {
        render: (userId, { item: entity }) => {
          return (
            <div className={s.idWrapper}>
              <Id to={getUserLink(entity)} testName="business-user-id">
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
    helper.simple<'kycStatus'>({
      title: 'KYC status',
      key: 'kycStatus',
      type: USER_KYC_STATUS_TAG,
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
    helper.simple<'userRegistrationStatus'>({
      title: `${firstLetterUpper(userAlias)} registration status`,
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
