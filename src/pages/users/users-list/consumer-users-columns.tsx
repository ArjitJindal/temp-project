import { ProColumns } from '@ant-design/pro-table';
import moment from 'moment';
import { Link } from 'react-router-dom';
import { Tag } from 'antd';
import { DEFAULT_DATE_TIME_DISPLAY_FORMAT, DEFAULT_DATE_DISPLAY_FORMAT } from '@/utils/dates';
import { InternalConsumerUser } from '@/apis';
import { getFullName } from '@/utils/api/users';

const convertToDateString = (createdTimestamp: number) =>
  moment(createdTimestamp).format(DEFAULT_DATE_TIME_DISPLAY_FORMAT);

export function getConsumerUserColumns(
  onUserIdClick: (user: InternalConsumerUser) => void = () => {},
): ProColumns<InternalConsumerUser>[] {
  return [
    {
      title: 'User ID',
      dataIndex: 'userId',
      width: 100,
      tip: 'Unique identification of user.',
      render: (dom, entity) => {
        // todo: fix style
        return (
          <Link
            to={`/users/list/consumer/${entity.userId}`}
            onClick={() => {
              onUserIdClick(entity);
            }}
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
      width: 100,
      hideInSearch: true,
      render: (dom, entity) => {
        return getFullName(entity.userDetails);
      },
      valueType: 'textarea',
    },
    {
      title: 'Date of Birth',
      width: 120,
      hideInSearch: true,
      render: (dom, entity) => {
        return entity.userDetails?.dateOfBirth
          ? moment(entity.userDetails?.dateOfBirth).format(DEFAULT_DATE_DISPLAY_FORMAT)
          : '';
      },
      valueType: 'textarea',
    },
    {
      title: 'Country of residence',
      hideInSearch: true,
      width: 150,
      render: (dom, entity) => {
        return entity.userDetails?.countryOfResidence;
      },
      valueType: 'textarea',
    },
    {
      title: 'Country of nationality',
      hideInSearch: true,
      width: 180,
      render: (dom, entity) => {
        return entity.userDetails?.countryOfNationality;
      },
      valueType: 'textarea',
    },
    {
      title: 'KYC Status',
      hideInSearch: true,
      width: 120,
      render: (dom, entity) => {
        return entity.kycStatusDetails?.status;
      },
      valueType: 'textarea',
    },
    {
      title: 'KYC Status Reason',
      hideInSearch: true,
      hideInTable: true,
      width: 180,
      render: (dom, entity) => {
        return entity.kycStatusDetails?.statusReason;
      },
      valueType: 'textarea',
    },
    {
      title: 'User Status',
      hideInSearch: true,
      width: 120,
      render: (dom, entity) => {
        return entity.userStateDetails?.state;
      },
      valueType: 'textarea',
    },
    {
      title: 'User Status Reason',
      hideInSearch: true,
      hideInTable: true,
      width: 150,
      render: (dom, entity) => {
        return entity.userStateDetails?.reason;
      },
      valueType: 'textarea',
    },
    {
      title: 'Tags',
      hideInSearch: true,
      dataIndex: 'tags',
      hideInForm: true,
      width: 100,
      render: (tags: any) => {
        if (tags instanceof Array) {
          return (
            <span>
              <Tag color={'cyan'}>
                {tags?.map((tag: any) => {
                  const key = Object.keys(tag)[0];
                  return (
                    <span>
                      {key}: <span style={{ fontWeight: 700 }}>{tag[key]}</span>
                    </span>
                  );
                })}
              </Tag>
            </span>
          );
        }
      },
    },
    {
      title: 'Created time',
      width: 150,
      sorter: (a, b) => a.createdTimestamp - b.createdTimestamp,
      dataIndex: 'createdTimestamp',
      valueType: 'dateTimeRange',
      render: (_, user) => {
        return convertToDateString(user.createdTimestamp);
      },
    },
  ];
}
