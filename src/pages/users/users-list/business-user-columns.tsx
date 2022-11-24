import moment from 'moment';
import { Link } from 'react-router-dom';
import { Tag } from 'antd';
import { DEFAULT_DATE_TIME_DISPLAY_FORMAT } from '@/utils/dates';
import { InternalBusinessUser } from '@/apis';
import { TableColumn } from '@/components/ui/Table/types';
import Money from '@/components/ui/Money';

export function getBusinessUserColumns(): TableColumn<InternalBusinessUser>[] {
  return [
    {
      title: 'User ID',
      dataIndex: 'userId',
      exportData: 'userId',
      tip: 'Unique identification of user.',
      width: 180,
      render: (dom, entity) => {
        // todo: fix style
        return (
          <Link
            to={`/users/list/business/${entity.userId}`}
            style={{ color: '@fr-colors-brandBlue' }}
            replace
          >
            {entity.userId}
          </Link>
        );
      },
    },
    {
      title: 'Legal Name',
      exportData: 'legalEntity.companyGeneralDetails.legalName',
      width: 120,
      hideInSearch: true,
      render: (dom, entity) => {
        return entity.legalEntity.companyGeneralDetails.legalName;
      },
      valueType: 'textarea',
    },
    {
      title: 'Industry',
      exportData: 'legalEntity.companyGeneralDetails.businessIndustry',
      width: 150,
      hideInSearch: true,
      render: (dom, entity) => {
        return (
          <div>
            {entity.legalEntity.companyGeneralDetails.businessIndustry
              ? entity.legalEntity.companyGeneralDetails.businessIndustry.map((industry) => {
                  return <Tag>{industry}</Tag>;
                })
              : '-'}
          </div>
        );
      },
      valueType: 'textarea',
    },
    {
      title: 'Expected Transaction Amount Per Month',
      width: 300,
      exportData: 'legalEntity.companyFinancialDetails.expectedTransactionAmountPerMonth',
      hideInSearch: true,
      render: (dom, entity) => {
        return (
          <Money
            amount={entity.legalEntity.companyFinancialDetails?.expectedTransactionAmountPerMonth}
          />
        );
      },
      valueType: 'textarea',
    },
    {
      title: 'Expected Turnover Amount Per Month',
      exportData: 'legalEntity.companyFinancialDetails.expectedTurnoverPerMonth',
      width: 300,
      hideInSearch: true,
      render: (dom, entity) => {
        return (
          <Money amount={entity.legalEntity.companyFinancialDetails?.expectedTurnoverPerMonth} />
        );
      },
      valueType: 'textarea',
    },
    {
      title: 'Maximum Daily Transaction Limit',
      width: 300,
      hideInSearch: true,
      exportData: 'transactionLimits.maximumDailyTransactionLimit',
      valueType: 'textarea',
      render: (_, entity) => {
        return <Money amount={entity.transactionLimits?.maximumDailyTransactionLimit} />;
      },
    },
    {
      title: 'Registration Identifier',
      width: 200,
      hideInSearch: true,
      exportData: 'legalEntity.companyRegistrationDetails.registrationIdentifier',
      render: (dom, entity) => {
        return entity.legalEntity.companyRegistrationDetails?.registrationIdentifier;
      },
      valueType: 'textarea',
    },
    {
      title: 'Registration Country',
      exportData: 'legalEntity.companyRegistrationDetails.registrationCountry',
      width: 200,
      hideInSearch: true,
      render: (dom, entity) => {
        return entity.legalEntity.companyRegistrationDetails?.registrationCountry;
      },
      valueType: 'textarea',
    },
    {
      title: 'Creation time',
      width: 150,
      sorter: true,
      dataIndex: 'createdTimestamp',
      exportData: (entity) =>
        moment(entity.createdTimestamp).format(DEFAULT_DATE_TIME_DISPLAY_FORMAT),
      valueType: 'dateTimeRange',
      render: (_, user) => {
        return moment(user.createdTimestamp).format(DEFAULT_DATE_TIME_DISPLAY_FORMAT);
      },
    },
  ];
}
