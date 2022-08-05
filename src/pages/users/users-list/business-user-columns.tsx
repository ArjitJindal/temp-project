import { ProColumns } from '@ant-design/pro-table';
import moment from 'moment';
import { Link } from 'react-router-dom';
import { DEFAULT_DATE_TIME_DISPLAY_FORMAT } from '@/utils/dates';
import { Amount, InternalBusinessUser } from '@/apis';

const createCurrencyStringFromAmount = (amount: Amount | undefined) => {
  return amount ? `${amount.amountValue} ${amount.amountCurrency}` : '-';
};

export function getBusinessUserColumns(
  onUserIdClick: (user: InternalBusinessUser) => void = () => {},
): ProColumns<InternalBusinessUser>[] {
  return [
    {
      title: 'User ID',
      dataIndex: 'userId',
      tip: 'Unique identification of user.',
      render: (dom, entity) => {
        // todo: fix style
        return (
          <Link
            to={`/users/list/business/${entity.userId}`}
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
      title: 'Legal Name',
      hideInSearch: true,
      render: (dom, entity) => {
        return entity.legalEntity.companyGeneralDetails.legalName;
      },
      valueType: 'textarea',
    },
    {
      title: 'Industry',
      hideInSearch: true,
      render: (dom, entity) => {
        return entity.legalEntity.companyGeneralDetails.businessIndustry;
      },
      valueType: 'textarea',
    },
    {
      title: 'Expected Transaction Amount Per Month',
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
      hideInSearch: true,
      dataIndex: 'maximumDailyTransactionLimit',
      valueType: 'textarea',
    },
    {
      title: 'Registration Identifier',
      hideInSearch: true,
      render: (dom, entity) => {
        return entity.legalEntity.companyRegistrationDetails?.registrationIdentifier;
      },
      valueType: 'textarea',
    },
    {
      title: 'Registration Country',
      hideInSearch: true,
      render: (dom, entity) => {
        return entity.legalEntity.companyRegistrationDetails?.registrationCountry;
      },
      valueType: 'textarea',
    },
    {
      title: 'Creation time',
      sorter: true,
      dataIndex: 'createdTimestamp',
      valueType: 'dateTimeRange',
      render: (_, user) => {
        return moment(user.createdTimestamp).format(DEFAULT_DATE_TIME_DISPLAY_FORMAT);
      },
    },
  ];
}
