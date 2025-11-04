import React, { useState } from 'react';
import s from './index.module.less';
import { useApi } from '@/api';
import { usePaginatedQuery, useQuery } from '@/utils/queries/hooks';
import {
  USERS_ENTITY_LINKED_ENTITIES_CHILD,
  USERS_ENTITY_LINKED_ENTITIES_PARENT,
} from '@/utils/queries/keys';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import { CommonParams, TableColumn } from '@/components/library/Table/types';
import { AllUsersTableItem } from '@/apis';
import { useFeatureEnabled, useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { getAllUserColumns } from '@/pages/users/users-list/all-user-columns';
import { useRiskClassificationScores } from '@/utils/risk-levels';
import { getRiskScoringColumns } from '@/pages/users/users-list/risk-scoring-column';
import ExpandIcon from '@/components/library/ExpandIcon';
import ExpandContainer from '@/components/utils/ExpandContainer';
import { DEFAULT_PAGE_SIZE, DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';

interface Props {
  userId: string;
}

export default function LinkedEntitiesTable({ userId }: Props) {
  const api = useApi();
  const settings = useSettings();
  const [isExpanded, setIsExpanded] = useState(false);
  const isRiskScoringEnabled = useFeatureEnabled('RISK_SCORING');
  const riskClassificationValues = useRiskClassificationScores();

  const [params, setParams] = useState<CommonParams>({
    ...DEFAULT_PARAMS_STATE,
  });

  const parentUsersQueryResult = useQuery(USERS_ENTITY_LINKED_ENTITIES_PARENT(userId), async () => {
    const result = await api.getUserEntityParentUser({
      userId,
    });
    return {
      items: result,
      total: result.length,
    };
  });

  const childUsersQueryResult = usePaginatedQuery(
    USERS_ENTITY_LINKED_ENTITIES_CHILD(userId, params),
    async (_) => {
      const { page = 1, pageSize = DEFAULT_PAGE_SIZE } = params;

      const result = await api.getUserEntityChildUsers({
        userId,
        page,
        pageSize,
      });
      return {
        items: result.items,
        total: result.count,
      };
    },
  );

  const columns: TableColumn<AllUsersTableItem>[] = getAllUserColumns(
    settings.userAlias,
  ) as TableColumn<AllUsersTableItem>[];

  if (isRiskScoringEnabled) {
    columns.push(...getRiskScoringColumns(riskClassificationValues, settings.riskLevelAlias ?? []));
  }

  return (
    <div className={s.root}>
      <div className={s.header} onClick={() => setIsExpanded(!isExpanded)}>
        <ExpandIcon isExpanded={isExpanded} color="BLACK" />
        <div className={s.title}>Linked entities</div>
      </div>
      <ExpandContainer isCollapsed={!isExpanded}>
        <div className={s.body}>
          <div className={s.section}>
            <div className={s.sectionTitle}>Parent user</div>
            <QueryResultsTable<AllUsersTableItem>
              key="parent-users"
              queryResults={parentUsersQueryResult}
              rowKey="userId"
              columns={columns}
              pagination={false}
              hideFilters
              toolsOptions={false}
            />
          </div>
          <div className={s.section}>
            <div className={s.sectionTitle}>Child users</div>
            <QueryResultsTable<AllUsersTableItem>
              key="child-users"
              queryResults={childUsersQueryResult}
              rowKey="userId"
              columns={columns}
              pagination={true}
              hideFilters
              toolsOptions={false}
              params={params}
              onChangeParams={setParams}
            />
          </div>
        </div>
      </ExpandContainer>
    </div>
  );
}
