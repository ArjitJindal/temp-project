import moment from 'moment';
import { Link } from 'react-router-dom';
import { DEFAULT_DATE_TIME_DISPLAY_FORMAT } from '@/utils/dates';
import { Amount, InternalBusinessUser } from '@/apis';
import { TableColumn } from '@/components/ui/Table/types';

const createCurrencyStringFromAmount = (amount: Amount | undefined) => {
  return amount ? `${amount.amountValue} ${amount.amountCurrency}` : '-';
};

export function getBusinessUserColumns(): TableColumn<InternalBusinessUser>[] {
  return [
    {
      title: 'User ID',
      dataIndex: 'userId',
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
      width: 120,
      hideInSearch: true,
      render: (dom, entity) => {
        return entity.legalEntity.companyGeneralDetails.legalName;
      },
      valueType: 'textarea',
    },
    {
      title: 'Industry',
      width: 150,
      hideInSearch: true,
      render: (dom, entity) => {
        return entity.legalEntity.companyGeneralDetails.businessIndustry;
      },
      valueType: 'textarea',
    },
    {
      title: 'Expected Transaction Amount Per Month',
      width: 300,
      hideInSearch: true,
      render: (dom, entity) => {
        return createCurrencyStringFromAmount(
          entity.legalEntity.companyFinancialDetails?.expectedTransactionAmountPerMonth,
        );
      },
      valueType: 'textarea',
    },
    {
      title: 'Expected Turnover Amount Per Month',
      width: 300,
      hideInSearch: true,
      render: (dom, entity) => {
        return createCurrencyStringFromAmount(
          entity.legalEntity.companyFinancialDetails?.expectedTurnoverPerMonth,
        );
      },
      valueType: 'textarea',
    },
    {
      title: 'Maximum Daily Transaction Limit',
      width: 300,
      hideInSearch: true,
      dataIndex: 'maximumDailyTransactionLimit',
      valueType: 'textarea',
    },
    {
      title: 'Registration Identifier',
      width: 200,
      hideInSearch: true,
      render: (dom, entity) => {
        return entity.legalEntity.companyRegistrationDetails?.registrationIdentifier;
      },
      valueType: 'textarea',
    },
    {
      title: 'Registration Country',
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
      valueType: 'dateTimeRange',
      render: (_, user) => {
        return moment(user.createdTimestamp).format(DEFAULT_DATE_TIME_DISPLAY_FORMAT);
      },
    },
  ];
}
