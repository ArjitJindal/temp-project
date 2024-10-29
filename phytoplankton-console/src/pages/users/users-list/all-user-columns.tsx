import { Link } from 'react-router-dom';
import React from 'react';
import { capitalize } from 'lodash';
import s from './styles.module.less';
import { InternalBusinessUser, InternalConsumerUser } from '@/apis';
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
import UserLink from '@/components/UserLink';

export function getAllUserColumns(): TableColumn<InternalConsumerUser | InternalBusinessUser>[] {
  const helper = new ColumnHelper<InternalConsumerUser | InternalBusinessUser>();

  return [
    helper.simple<'userId'>({
      title: 'User ID',
      key: 'userId',
      tooltip: 'Unique identification of user.',
      type: {
        render: (userId, { item: entity }) => {
          return <UserLink user={entity}>{userId}</UserLink>;
        },
        link: (userId, entity) => {
          return getUserLink(entity) ?? '#';
        },
      },
    }),
    helper.simple<'userDetails'>({
      title: 'Name',
      key: 'userDetails',
      id: 'userName',
      type: {
        render: (userDetails, { item: entity }) => (
          <Link to={`/users/list/${entity.type?.toLowerCase()}/${entity.userId}`} replace>
            {getUserName(entity)}
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
        render: (type: 'BUSINESS' | 'CONSUMER' | undefined) => {
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
    helper.simple<'kycStatusDetails'>({
      title: 'KYC status',
      id: 'kycStatus',
      type: USER_KYC_STATUS_TAG,
      key: 'kycStatusDetails',
      tooltip: 'KYC status of user.',
    }),
    helper.simple<'userStateDetails.state'>({
      title: 'User status',
      type: USER_STATE_TAG,
      key: 'userStateDetails.state',
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
