import { Link } from 'react-router-dom';
import React from 'react';
import { firstLetterUpper } from '@flagright/lib/utils/humanize';
import { capitalize } from 'lodash';
import s from './styles.module.less';
import { UserType } from '@/apis';
import { TableColumn } from '@/components/library/Table/types';
import { getUserLink, getUserName } from '@/utils/api/users';
import UserTypeIcon from '@/components/ui/UserTypeIcon';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import {
  DATE,
  TAGS,
  USER_KYC_STATUS_TAG,
  USER_STATE_TAG,
} from '@/components/library/Table/standardDataTypes';
import { AllUserTableItem } from '@/pages/users/users-list/data';
import PendingApprovalTag from '@/components/library/Tag/PendingApprovalTag';

export function getAllUserColumns(userAlias?: string): TableColumn<AllUserTableItem>[] {
  const helper = new ColumnHelper<AllUserTableItem>();

  return [
    helper.simple<'userId'>({
      title: `${firstLetterUpper(userAlias)} ID`,
      key: 'userId',
      tooltip: `Unique identification of ${userAlias}.`,
      type: {
        render: (userId, { item: entity }) => {
          return (
            <div className={s.idWrapper}>
              <Link to={getUserLink(entity) ?? '#'}>{userId}</Link>
              {!!entity.proposals?.length && <PendingApprovalTag />}
            </div>
          );
        },
        link: (userId, entity) => {
          return getUserLink(entity) ?? '#';
        },
      },
    }),
    helper.simple<'name'>({
      title: 'Name',
      key: 'name',
      id: 'userName',
      type: {
        render: (name, { item: entity }) => (
          <Link to={getUserLink(entity) ?? '#'} replace>
            {name}
          </Link>
        ),
        stringify: (_value, entity) => getUserName(entity),
      },
    }),
    helper.simple<'type'>({
      title: `${firstLetterUpper(userAlias)} type`,
      key: 'type',
      tooltip: `Type of ${userAlias}.`,
      type: {
        render: (type: UserType | undefined) => {
          if (type == null) {
            return <></>;
          }

          return (
            <div className={s.userType}>
              <UserTypeIcon type={type} /> <span>{capitalize(type)}</span>
            </div>
          );
        },
      },
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
