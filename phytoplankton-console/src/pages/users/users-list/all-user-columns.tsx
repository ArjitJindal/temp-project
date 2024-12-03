import { Link } from 'react-router-dom';
import React from 'react';
import { capitalize } from 'lodash';
import s from './styles.module.less';
import { AllUsersTableItem, UserType } from '@/apis';
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

export function getAllUserColumns(): TableColumn<AllUsersTableItem>[] {
  const helper = new ColumnHelper<AllUsersTableItem>();

  return [
    helper.simple<'userId'>({
      title: 'User ID',
      key: 'userId',
      tooltip: 'Unique identification of user.',
      type: {
        render: (userId, { item: entity }) => {
          return <Link to={getUserLink(entity) ?? '#'}>{userId}</Link>;
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
      title: 'User type',
      key: 'type',
      tooltip: 'Type of user.',
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
      tooltip: 'KYC status of user.',
    }),
    helper.simple<'userState'>({
      title: 'User status',
      type: USER_STATE_TAG,
      key: 'userState',
      id: 'userStatus',
      tooltip: 'Status of user.',
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
