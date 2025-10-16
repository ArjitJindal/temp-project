import { COUNTRIES } from '@flagright/lib/constants';
import { humanizeAuto } from '@flagright/lib/utils/humanize';
import { CellInput, Styles } from 'jspdf-autotable';
import { getRiskLevelFromScore, isNotArsChangeTxId } from '@flagright/lib/utils';
import { RiskScores } from '../Header/HeaderMenu';
import {
  ExtendedDrsScore,
  InternalBusinessUser,
  InternalConsumerUser,
  LegalEntity,
  Person,
  RiskClassificationScore,
  RiskFactor,
  RiskFactorParameter,
  RiskScoreComponent,
  TenantSettings,
} from '@/apis';
import { TableOptions } from '@/components/DownloadAsPdf/DownloadAsPDF';
import { ReportItem, getTable, getWidgetTable } from '@/components/DownloadAsPdf/report-utils';
import { DATE_TIME_FORMAT_WITHOUT_SECONDS, dayjs } from '@/utils/dayjs';
import { getRiskLevelLabel } from '@/components/AppWrapper/Providers/SettingsProvider';
import {
  DEFAULT_RENDERER,
  PARAMETER_RENDERERS,
  findParameter,
} from '@/components/ui/RiskScoreDisplay/DetailsModal/helpers';
import { PaginatedData } from '@/utils/queries/hooks';
import { MAXIMUM_EXPORT_ITEMS } from '@/utils/data-export';
import { QueryResult } from '@/utils/queries/types';
import { DATE_TIME_FORMAT } from '@/components/library/DateRangePicker/DateTimeTextInput';

export const drsTableHeaders = [
  'CRA risk score',
  'CRA risk level',
  'Transaction ID',
  'TRS risk level',
  'TRS risk score',
  'Timestamp',
  'Risk Factors',
];

const getUserWidgetsProps = (
  user: InternalBusinessUser | InternalConsumerUser,
  riskScores: RiskScores,
  tenantSettings: TenantSettings,
  riskClassificationValues: Array<RiskClassificationScore>,
): ReportItem[] => {
  const drsRiskScore = riskScores?.drsRiskScore;
  const kycRiskScore = riskScores?.kycRiskScore;
  const configRiskLevelAliasArray = tenantSettings?.riskLevelAlias || [];
  const userType = user.type;
  const companyDetails =
    user.type === 'BUSINESS' ? user.legalEntity.companyGeneralDetails : undefined;
  const krsRiskScore = user.krsScore?.krsScore;

  const craRiskLevel = drsRiskScore?.riskLevel
    ? drsRiskScore.riskLevel
    : drsRiskScore?.score
    ? getRiskLevelFromScore(riskClassificationValues, drsRiskScore.score, configRiskLevelAliasArray)
    : drsRiskScore?.manualRiskLevel;
  const krsRiskLevel = user.krsScore?.riskLevel
    ? user.krsScore?.riskLevel
    : krsRiskScore
    ? getRiskLevelFromScore(riskClassificationValues, krsRiskScore, configRiskLevelAliasArray)
    : user.krsScore?.manualRiskLevel;

  const krsLabel = krsRiskLevel
    ? getRiskLevelLabel(krsRiskLevel, tenantSettings).riskLevelLabel
    : '-';
  const drsLabel = craRiskLevel
    ? `${getRiskLevelLabel(craRiskLevel, tenantSettings).riskLevelLabel} `
    : '-';
  const userAlias = humanizeAuto(tenantSettings.userAlias ?? 'User');
  const userDetails: ReportItem[] = [
    {
      title: `${userAlias} ID`,
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
      title: `${userAlias} status`,
      value: humanizeAuto(user.userStateDetails?.state ?? '-'),
    },
    ...(kycRiskScore !== null
      ? [
          {
            title: 'KYC risk score (KRS)',
            value: `${krsRiskScore?.toFixed(2) ?? '-'} (${krsLabel})`,
          },
        ]
      : []),
    ...(drsRiskScore !== null
      ? [
          {
            title: 'CRA risk score',
            value: `${drsRiskScore?.score?.toFixed(2) ?? '-'} (${drsLabel})`,
          },
        ]
      : []),
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
        title: `${index + 1}. ${name?.firstName} ${name?.middleName ?? ''} ${name?.lastName ?? ''}`,
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

export const getUserWidgetTable = (
  user: InternalBusinessUser | InternalConsumerUser,
  riskScores: RiskScores,
  tenantSettings: TenantSettings,
  riskClassificationValues: Array<RiskClassificationScore>,
): TableOptions => {
  const props = getUserWidgetsProps(user, riskScores, tenantSettings, riskClassificationValues);
  return getWidgetTable(props);
};

const getValue = (entity: RiskScoreComponent) => {
  const { entityType, parameter, value } = entity;
  if (value == null) {
    return '-';
  }
  const parameterDescription = findParameter(entityType, parameter as RiskFactorParameter);
  if (parameterDescription == null) {
    return JSON.stringify(value);
  }
  const valueRenderer = PARAMETER_RENDERERS[parameterDescription.dataType] ?? DEFAULT_RENDERER;
  return valueRenderer(value).stringify;
};

const getUserSupportTables = (
  user: InternalBusinessUser | InternalConsumerUser,
  riskScores: RiskScores,
  tenantSettings: TenantSettings,
): TableOptions[] => {
  const head = ['Risk factor', 'Value', 'Risk score', 'Risk level'];
  const tableValues = ['KRS details', 'CRA details'].map((title) => {
    return {
      title,
      rows:
        riskScores.kycRiskScore?.components?.map((component) => {
          const parameterName =
            findParameter(component.entityType, component.parameter as RiskFactorParameter)
              ?.title ?? component.parameter;
          const parameterValue = getValue(component);
          return [
            parameterName,
            parameterValue,
            component.score,
            getRiskLevelLabel(component.riskLevel, tenantSettings).riskLevelLabel,
          ];
        }) ?? [],
    };
  });
  return tableValues
    .filter(({ rows }) => rows.length > 0)
    .map(({ title, rows }) => {
      return getTable(head, rows, title);
    });
};

const getDrsSupportTables = (
  drsScores: ExtendedDrsScore[],
  factorMap: Record<string, RiskFactor>,
): TableOptions[] => {
  const tableValues = {
    title: 'CRA details',
    columnStyles: {
      riskFactors: {
        cellWidth: 20,
      } as Partial<Styles>,
      transactionId: {
        cellWidth: 'wrap',
      } as Partial<Styles>,
    },
    rows:
      drsScores
        .map((drsScore) => {
          // combining the default and custom risk factors
          const defaultRiskFactors = drsScore.components
            ?.map((component) => {
              const parameterName =
                findParameter(component.entityType, component.parameter as RiskFactorParameter)
                  ?.title ?? component.parameter;
              const parameterValue = getValue(component);
              return `${parameterName} (${parameterValue}) - ${component.score}`;
            })
            .join('\n');

          const customRiskFactors = drsScore.factorScoreDetails
            ?.map((factor) => {
              const isDefault = !!factorMap[factor.riskFactorId]?.parameter;
              if (!isDefault) {
                const rf = factorMap[factor.riskFactorId];
                const parameterName = rf.name;
                const parameterValue = rf.description;
                return `${parameterName} (${parameterValue}) - ${factor.score}`;
              }
            })
            .filter(Boolean)
            .join('\n');

          const riskFactors = [defaultRiskFactors, customRiskFactors].join('');

          const shouldShowTransactionId = !isNotArsChangeTxId(drsScore.transactionId);

          return [
            { value: drsScore.drsScore.toFixed(2), fontSize: 8 },
            { value: drsScore.derivedRiskLevel ?? '-', fontSize: 8 },
            {
              value:
                shouldShowTransactionId && drsScore.transactionId ? drsScore.transactionId : '-',
              fontSize: 8,
            },
            { value: drsScore.arsRiskLevel ?? '-', fontSize: 8 },
            { value: drsScore.arsRiskScore?.toFixed(2) ?? '-', fontSize: 8 },
            {
              value: dayjs(drsScore.createdAt).format(DATE_TIME_FORMAT),
              fontSize: 8,
            },
            { value: riskFactors, fontSize: 6 },
          ].map((row) => ({
            styles: {
              fontSize: row.fontSize,
            },
            content: row.value,
          }));
        })
        .filter((row) => row)
        .map((row) => row as CellInput[]) ?? [],
  };
  return [getTable(drsTableHeaders, tableValues.rows, tableValues.title, tableValues.columnStyles)];
};

export const getUserReportTables = (
  user: InternalBusinessUser | InternalConsumerUser,
  riskScores: RiskScores,
  tenantSettings: TenantSettings,
  riskClassificationValues: Array<RiskClassificationScore>,
): TableOptions[] => {
  return [
    getUserWidgetTable(user, riskScores, tenantSettings, riskClassificationValues),
    ...getUserSupportTables(user, riskScores, tenantSettings),
  ];
};

export const getUserDrsReportTables = async (
  queryResults: QueryResult<PaginatedData<ExtendedDrsScore>>,
  exportConfig: {
    pageSize: number;
    page: number;
    exportSinglePage: boolean;
  } = {
    pageSize: 100,
    page: 1,
    exportSinglePage: false,
  },
  factorMap: Record<string, RiskFactor>,
): Promise<TableOptions[]> => {
  const maxLimit = MAXIMUM_EXPORT_ITEMS;

  const drsScores: ExtendedDrsScore[] = [];
  const params = {
    pageSize: exportConfig.pageSize,
    page: exportConfig.page,
  };

  while (drsScores.length < maxLimit) {
    const result = (await queryResults?.paginate?.(params)) ?? { items: [], total: 0 };
    const responseItems = result.items.length;
    if (responseItems === 0) {
      break;
    }
    // will never hit this condiition just a safety check
    if (drsScores.length + responseItems > maxLimit) {
      const bufferItems = result.items.slice(0, maxLimit - drsScores.length);
      drsScores.push(...bufferItems);
      break;
    }
    drsScores.push(...result.items);
    if (exportConfig.exportSinglePage) {
      break;
    }
    params.page++;
  }
  return getDrsSupportTables(drsScores, factorMap);
};
