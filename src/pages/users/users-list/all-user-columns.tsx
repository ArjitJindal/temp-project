import { Link } from 'react-router-dom';
import _ from 'lodash';
import moment from 'moment';
import s from './styles.module.less';
import UserRiskTag from './UserRiskTag';
import { InternalUser } from '@/apis';
import { TableColumn } from '@/components/ui/Table/types';
import TimestampDisplay from '@/components/ui/TimestampDisplay';
import UserKycStatusTag from '@/components/ui/UserKycStatusTag';
import UserStateTag from '@/components/ui/UserStateTag';
import { getUserName } from '@/utils/api/users';
import UserTypeIcon from '@/components/ui/UserTypeIcon';
import { DEFAULT_DATE_TIME_DISPLAY_FORMAT } from '@/utils/dates';

export function getAllUserColumns(): TableColumn<InternalUser>[] {
  return [
    {
      title: 'User ID',
      dataIndex: 'userId',
      tip: 'Unique identification of user.',
      width: 180,
      exportData: 'userId',
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
      title: 'User Type',
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
      title: 'Risk Level',
      dataIndex: 'riskLevel',
      exportData: 'riskLevel',
      hideInSearch: true,
      tip: 'Risk level of user.',
      width: 180,
      render: (dom, entity) => {
        return <UserRiskTag userId={entity.userId} />;
      },
    },
    {
      title: 'KYC Status',
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
      title: 'User Status',
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
      title: 'Created On',
      dataIndex: 'createdTimestamp',
      valueType: 'dateRange',
      tip: 'Date and time when user was created.',
      sorter: true,
      width: 180,
      exportData: (entity) =>
        moment(entity.createdTimestamp).format(DEFAULT_DATE_TIME_DISPLAY_FORMAT),
      render: (dom, entity) => {
        return <TimestampDisplay timestamp={entity.createdTimestamp} />;
      },
    },
  ];
}
