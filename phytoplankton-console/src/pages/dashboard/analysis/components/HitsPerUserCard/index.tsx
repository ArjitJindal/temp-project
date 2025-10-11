/* eslint-disable @typescript-eslint/no-var-requires */
import { firstLetterUpper } from '@flagright/lib/utils/humanize';
import { RangeValue } from 'rc-picker/es/interface';
import { Link } from 'react-router-dom';
import pluralize from 'pluralize';
import { round } from 'lodash';
import { TableItem } from './types';
import { generateAlertsListUrl } from './utils';
import { Dayjs } from '@/utils/dayjs';
import UserLink from '@/components/UserLink';
import { getUserLink } from '@/utils/api/users';
import { TableColumn } from '@/components/library/Table/types';
import type { PaginatedData } from '@/utils/queries/hooks';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import { getCurrentDomain } from '@/utils/routing';
import { ColumnHelper } from '@/components/library/Table/columnHelper';
import { DashboardStatsHitsPerUserData } from '@/apis';
import type { QueryResult } from '@/utils/queries/types';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';

interface Props {
  direction?: 'ORIGIN' | 'DESTINATION';
  userType: 'BUSINESS' | 'CONSUMER';
  dateRange: RangeValue<Dayjs>;
  hitsPerUserResult: QueryResult<PaginatedData<DashboardStatsHitsPerUserData>>;
}

export default function HitsPerUserCard(props: Props) {
  const { dateRange, direction } = props;
  const settings = useSettings();
  const capitalizeUserAlias = firstLetterUpper(settings.userAlias);

  const helper = new ColumnHelper<TableItem>();
  const columns: TableColumn<TableItem>[] = helper.list([
    helper.simple<'userId'>({
      key: 'userId',
      title: `${capitalizeUserAlias} ID`,
      type: {
        render: (userId, { item: entity }) => {
          const { userType } = entity;
          if (!userType) {
            return <>{userId}</>;
          }
          return (
            <UserLink
              user={{ userId: entity.userId, type: entity.userType as 'BUSINESS' | 'CONSUMER' }}
            >
              {userId}
            </UserLink>
          );
        },
        stringify(value) {
          return `${value}`;
        },
        link: (value, item) =>
          getUserLink({ userId: item.userId, type: item.userType as 'BUSINESS' | 'CONSUMER' }) ??
          '',
      },
    }),
    helper.derived<string>({
      title: 'Username',
      value: (entity: TableItem): string => entity.userName ?? '',
    }),
    helper.simple<'rulesHitCount'>({
      title: 'Rules hit',
      key: 'rulesHitCount',
      type: {
        render: (rulesHitCount, { item }) => {
          return (
            <>{`${rulesHitCount} ${pluralize('hit', rulesHitCount)} (${round(
              (item.rulesHitCount / item.rulesRunCount) * 100,
              2,
            )}%)`}</>
          );
        },
        stringify(value) {
          return `${value} (${pluralize('hit', value)})`;
        },
      },
    }),
    helper.simple<'openAlertsCount'>({
      title: 'Open alerts',
      key: 'openAlertsCount',
      enableResizing: false,
      type: {
        render: (openAlertsCount, { item: entity }) => {
          return (
            <>
              <Link
                to={
                  entity.userId
                    ? generateAlertsListUrl({ userId: entity.userId }, direction, dateRange)
                    : '#'
                }
              >
                {openAlertsCount} open {pluralize('alert', openAlertsCount)}
              </Link>
            </>
          );
        },
        stringify(value, item) {
          const link = item.userId
            ? `(${getCurrentDomain()}${generateAlertsListUrl(
                { userId: item.userId },
                direction,
                dateRange,
              )})`
            : undefined;
          return `${value} ${link}`;
        },
      },
    }),
  ]);

  return (
    <QueryResultsTable<TableItem>
      rowKey="userId"
      columns={columns}
      queryResults={props.hitsPerUserResult}
      pagination={false}
      sizingMode="SCROLL"
      toolsOptions={{
        setting: false,
        download: false,
        reload: false,
      }}
      fitHeight={300}
      externalHeader={true}
    />
  );
}
