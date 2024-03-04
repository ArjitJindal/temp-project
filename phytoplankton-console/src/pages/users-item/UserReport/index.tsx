import { COUNTRIES } from '@flagright/lib/constants';
import { RiskScore, RiskScores } from '../Header/HeaderMenu';
import { InternalBusinessUser, InternalConsumerUser, LegalEntity, Person } from '@/apis';
import { TableOptions } from '@/components/DownloadAsPdf/DownloadAsPDF';
import { ReportItem, getTable, getWidgetTable } from '@/components/DownloadAsPdf/report-utils';
import { DATE_TIME_FORMAT_WITHOUT_SECONDS, dayjs } from '@/utils/dayjs';
import { humanizeAuto } from '@/utils/humanize';

const getUserWidgetsProps = (
  user: InternalBusinessUser | InternalConsumerUser,
  drsRiskScore?: RiskScore,
): ReportItem[] => {
  const userType = user.type;
  const companyDetails =
    user.type === 'BUSINESS' ? user.legalEntity.companyGeneralDetails : undefined;
  const userDetails: ReportItem[] = [
    {
      title: 'User ID',
      value: user.userId,
      id: { cellId: 'link' },
    },
    {
      title: 'Type',
      value: humanizeAuto(userType),
      id: { cellId: 'bold' },
    },
    ...(userType === 'BUSINESS'
      ? [
          {
            title: 'Business Industry',
            value:
              companyDetails?.businessIndustry?.map((item) => humanizeAuto(item)).join(', ') ?? '-',
          },
          {
            title: 'Business Industry',
            value:
              companyDetails?.mainProductsServicesSold
                ?.map((item) => humanizeAuto(item))
                .join(', ') ?? '-',
          },
        ]
      : []),
    {
      title: 'Time of download',
      value: dayjs().format(DATE_TIME_FORMAT_WITHOUT_SECONDS),
    },
    {
      title: 'KYC status',
      value: humanizeAuto(user.kycStatusDetails?.status ?? '-'),
    },
    {
      title: 'User status',
      value: humanizeAuto(user.userStateDetails?.state ?? '-'),
    },
    {
      title: 'KYC risk score (KRS)',
      value: `${humanizeAuto(user.krsScore?.riskLevel ?? '-')} (${user.krsScore?.krsScore ?? '-'})`,
    },
    {
      title: 'CRA risk score',
      value: `${humanizeAuto(drsRiskScore?.riskLevel ?? drsRiskScore?.manualRiskLevel ?? '-')} (${
        drsRiskScore?.score ?? '-'
      })`,
    },
    ...(userType === 'CONSUMER'
      ? [
          {
            title: 'Country of residence',
            value: user.userDetails?.countryOfResidence
              ? COUNTRIES[user.userDetails?.countryOfResidence]
              : '-',
          },
          {
            title: 'Country of nationality',
            value: user.userDetails?.countryOfNationality
              ? COUNTRIES[user.userDetails?.countryOfNationality]
              : '-',
          },
        ]
      : []),
  ];

  const registrationDetails: ReportItem[] =
    userType === 'BUSINESS'
      ? [
          {
            title: 'Registration details',
            value: '',
            id: {
              rowId: 'header',
            },
          },
          ...getUserRegistrationDetails(user.legalEntity),
        ]
      : [];
  const shareHolderDetails: ReportItem[] =
    userType === 'BUSINESS' && user.shareHolders
      ? [
          {
            title: 'Shareholders',
            value: '',
            id: { rowId: 'header' },
          },
          ...getPersonDetails(user.shareHolders),
        ]
      : [];

  const directorsDetails: ReportItem[] =
    userType === 'BUSINESS' && user.directors
      ? [
          {
            title: 'Directors',
            value: '',
            id: { rowId: 'header' },
          },
          ...getPersonDetails(user.directors),
        ]
      : [];

  return [...userDetails, ...registrationDetails, ...shareHolderDetails, ...directorsDetails];
};

function getUserRegistrationDetails(legalEntity: LegalEntity): ReportItem[] {
  const { companyGeneralDetails, companyRegistrationDetails } = legalEntity;
  return [
    {
      title: 'Registration status',
      value: companyGeneralDetails?.userRegistrationStatus ?? '-',
    },
    {
      title: 'Customer segment',
      value: companyGeneralDetails?.userSegment ?? '-',
    },
    {
      title: 'Registration ID',
      value: companyRegistrationDetails?.registrationIdentifier ?? '-',
    },
    {
      title: 'Tax ID',
      value: companyRegistrationDetails?.taxIdentifier ?? '-',
    },
    {
      title: 'Legal entity type',
      value: companyRegistrationDetails?.legalEntityType ?? '-',
    },
    {
      title: 'Country of registration',
      value: companyRegistrationDetails?.registrationCountry
        ? COUNTRIES[companyRegistrationDetails?.registrationCountry]
        : '-',
    },
  ];
}

function getPersonDetails(shareHolders: Array<Person>): ReportItem[] {
  return shareHolders?.flatMap((shareHolder, index) => {
    const name = shareHolder?.generalDetails?.name;
    return [
      {
        title: `${index + 1}. ${name.firstName} ${name.middleName ?? ''} ${name.lastName ?? ''}`,
        value: '',
        id: { rowId: 'item' },
      },
      {
        title: 'Country of residence',
        value: shareHolder?.generalDetails?.countryOfResidence
          ? COUNTRIES[shareHolder?.generalDetails?.countryOfResidence]
          : '-',
      },
      {
        title: 'Country of nationality',
        value: shareHolder?.generalDetails?.countryOfNationality
          ? COUNTRIES[shareHolder?.generalDetails?.countryOfNationality]
          : '-',
      },
    ];
  });
}

const getUserWidgetTable = (
  user: InternalBusinessUser | InternalConsumerUser,
  drsRiskScore?: RiskScore,
): TableOptions => {
  const props = getUserWidgetsProps(user, drsRiskScore);
  return getWidgetTable(props);
};

const getUserSupportTables = (
  user: InternalBusinessUser | InternalConsumerUser,
  riskScores: RiskScores,
): TableOptions[] => {
  const head = ['Risk factor', 'Value', 'Risk score', 'Risk level'];
  const tableValues = ['KRS details', 'CRA details'].map((title) => {
    return {
      title,
      rows:
        riskScores.kycRiskScore?.components?.map((component) => {
          const riskFactor = humanizeAuto(component.parameter.split('.').pop() ?? '');
          let parsedValue = component.value;
          if (riskFactor.toLowerCase().includes('country')) {
            parsedValue = COUNTRIES[component.value] ?? component.value;
          } else if (riskFactor.toLowerCase().includes('age')) {
            parsedValue = dayjs(parsedValue).format(DATE_TIME_FORMAT_WITHOUT_SECONDS);
          } else {
            parsedValue = humanizeAuto(parsedValue);
          }
          return [riskFactor, parsedValue, component.score, humanizeAuto(component.riskLevel)];
        }) ?? [],
    };
  });
  return tableValues
    .filter(({ rows }) => rows.length > 0)
    .map(({ title, rows }) => {
      return getTable(head, rows, title);
    });
};

export const getUserReportTables = (
  user: InternalBusinessUser | InternalConsumerUser,
  riskScores: RiskScores,
): TableOptions[] => {
  return [
    getUserWidgetTable(user, riskScores.drsRiskScore),
    ...getUserSupportTables(user, riskScores),
  ];
};
