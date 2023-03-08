import { Link } from 'react-router-dom';
import React from 'react';
import { dayjs, DEFAULT_DATE_FORMAT, DEFAULT_DATE_TIME_FORMAT } from '@/utils/dayjs';
import { InternalConsumerUser } from '@/apis';
import { getFullName } from '@/utils/api/users';
import CountryDisplay from '@/components/ui/CountryDisplay';
import { TableColumn } from '@/components/ui/Table/types';
import KeyValueTag from '@/components/ui/KeyValueTag';

const convertToDateString = (createdTimestamp: number) =>
  dayjs(createdTimestamp).format(DEFAULT_DATE_TIME_FORMAT);

export function getConsumerUserColumns(): TableColumn<InternalConsumerUser>[] {
  return [
    {
      title: 'User ID',
      dataIndex: 'userId',
      exportData: 'userId',
      hideInSearch: true,
      width: 100,
      tip: 'Unique identification of user.',
      render: (dom, entity) => {
        // todo: fix style
        return (
          <Link
            to={`/users/list/consumer/${entity.userId}`}
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
      exportData: (entity) => getFullName(entity.userDetails),
      width: 100,
      hideInSearch: true,
      render: (dom, entity) => {
        return getFullName(entity.userDetails);
      },
      valueType: 'textarea',
    },
    {
      title: 'Date of birth',
      exportData: 'userDetails.dateOfBirth',
      width: 120,
      hideInSearch: true,
      render: (dom, entity) => {
        return entity.userDetails?.dateOfBirth
          ? dayjs(entity.userDetails?.dateOfBirth).format(DEFAULT_DATE_FORMAT)
          : '';
      },
      valueType: 'textarea',
    },
    {
      title: 'Country of residence',
      exportData: 'userDetails.countryOfResidence',
      hideInSearch: true,
      width: 150,
      render: (dom, entity) => {
        return <CountryDisplay isoCode={entity.userDetails?.countryOfResidence} />;
      },
      valueType: 'textarea',
    },
    {
      title: 'Country of nationality',
      exportData: 'userDetails.countryOfNationality',
      hideInSearch: true,
      width: 180,
      render: (dom, entity) => {
        return <CountryDisplay isoCode={entity.userDetails?.countryOfNationality} />;
      },
      valueType: 'textarea',
    },
    {
      title: 'KYC status',
      exportData: 'kycStatusDetails.status',
      hideInSearch: true,
      width: 120,
      render: (dom, entity) => {
        return entity.kycStatusDetails?.status;
      },
      valueType: 'textarea',
    },
    {
      title: 'KYC status reason',
      exportData: 'kycStatusDetails.reason',
      hideInSearch: true,
      hideInTable: false,
      width: 180,
      render: (dom, entity) => {
        return entity.kycStatusDetails?.reason;
      },
      valueType: 'textarea',
    },
    {
      title: 'User state',
      exportData: 'userStateDetails.state',
      hideInSearch: true,
      hideInDescriptions: true,
      width: 120,
      render: (dom, entity) => {
        return entity.userStateDetails?.state;
      },
      valueType: 'textarea',
    },
    {
      title: 'Tags',
      hideInSearch: true,
      exportData: 'tags',
      hideInForm: true,
      width: 200,
      render: (dom, entity) => {
        if (entity.tags instanceof Array) {
          return (
            <>
              {entity.tags?.map((tag: any) => (
                <KeyValueTag key={tag.key} tag={tag} />
              ))}
            </>
          );
        }
      },
    },
    {
      title: 'Created on',
      width: 150,
      sorter: (a, b) => a.createdTimestamp - b.createdTimestamp,
      dataIndex: 'createdTimestamp',
      valueType: 'dateRange',
      exportData: (entity) => dayjs(entity.createdTimestamp).format(DEFAULT_DATE_TIME_FORMAT),
      render: (_, user) => {
        return convertToDateString(user.createdTimestamp);
      },
    },
  ];
}
