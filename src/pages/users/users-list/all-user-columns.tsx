import { Link } from 'react-router-dom';
import _ from 'lodash';
import s from './styles.module.less';
import { dayjs, DEFAULT_DATE_TIME_FORMAT } from '@/utils/dayjs';
import { InternalUser } from '@/apis';
import { TableColumn } from '@/components/ui/Table/types';
import TimestampDisplay from '@/components/ui/TimestampDisplay';
import UserKycStatusTag from '@/components/ui/UserKycStatusTag';
import UserStateTag from '@/components/ui/UserStateTag';
import { getUserName } from '@/utils/api/users';
import UserTypeIcon from '@/components/ui/UserTypeIcon';

export function getAllUserColumns(): TableColumn<InternalUser>[] {
  return [
    {
      title: 'User ID',
      dataIndex: 'userId',
      tip: 'Unique identification of user.',
      width: 180,
      exportData: 'userId',
      hideInSearch: true,
      render: (dom, entity) => {
        return (
          <Link
            to={`/users/list/${entity.type.toLowerCase()}/${entity.userId}`}
            style={{ color: '@fr-colors-brandBlue' }}
            replace
          >
            {entity.userId}
          </Link>
        );
      },
    },
    {
      title: 'Name',
      dataIndex: 'userName',
      width: 180,
      hideInSearch: true,
      exportData: (entity) => getUserName(entity),
      render: (dom, entity) => {
        return (
          <Link
            to={`/users/list/${entity.type.toLowerCase()}/${entity.userId}`}
            style={{ color: '@fr-colors-brandBlue' }}
            replace
          >
            {getUserName(entity)}
          </Link>
        );
      },
    },
    {
      title: 'User type',
      dataIndex: 'type',
      tip: 'Type of user.',
      hideInSearch: true,
      exportData: 'type',
      render: (dom, user) => {
        if (!user) {
          return '-';
        }
        return (
          <div className={s.userType}>
            <UserTypeIcon type={user.type} /> <span>{_.capitalize(user.type)}</span>
          </div>
        );
      },
    },
    {
      title: 'KYC status',
      dataIndex: 'kycStatus',
      exportData: (entity) => entity.kycStatusDetails?.status,
      hideInSearch: true,
      tip: 'KYC status of user.',
      width: 180,
      render: (dom, entity) => {
        const kycStatusDetails = entity.kycStatusDetails;
        return kycStatusDetails && <UserKycStatusTag kycStatusDetails={kycStatusDetails} />;
      },
    },
    {
      title: 'User status',
      dataIndex: 'userStatus',
      tip: 'Status of user.',
      hideInSearch: true,
      width: 180,
      render: (_, entity) => {
        const userState = entity.userStateDetails?.state;
        return userState && <UserStateTag userState={userState} />;
      },
      exportData: (entity) => entity.userStateDetails?.state,
    },
    {
      title: 'Created on',
      dataIndex: 'createdTimestamp',
      valueType: 'dateRange',
      tip: 'Date and time when user was created.',
      sorter: true,
      width: 180,
      exportData: (entity) => dayjs(entity.createdTimestamp).format(DEFAULT_DATE_TIME_FORMAT),
      render: (dom, entity) => {
        return <TimestampDisplay timestamp={entity.createdTimestamp} />;
      },
    },
  ];
}
