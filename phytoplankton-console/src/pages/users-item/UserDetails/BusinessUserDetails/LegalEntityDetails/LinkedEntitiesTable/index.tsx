import { useState } from 'react';
import s from './index.module.less';
import QueryResultsTable from '@/components/shared/QueryResultsTable';
import { CommonParams, TableColumn } from '@/components/library/Table/types';
import { AllUsersTableItem } from '@/apis';
import { useFeatureEnabled, useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { getAllUserColumns } from '@/pages/users/users-list/all-user-columns';
import { useRiskClassificationScores } from '@/utils/risk-levels';
import { getRiskScoringColumns } from '@/pages/users/users-list/risk-scoring-column';
import ExpandIcon from '@/components/library/ExpandIcon';
import ExpandContainer from '@/components/utils/ExpandContainer';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import {
  useUserEntityLinkedEntitiesChild,
  useUserEntityLinkedEntitiesParent,
} from '@/utils/api/users';

interface Props {
  userId: string;
}

export default function LinkedEntitiesTable({ userId }: Props) {
  const settings = useSettings();
  const [isExpanded, setIsExpanded] = useState(false);
  const isRiskScoringEnabled = useFeatureEnabled('RISK_SCORING');
  const riskClassificationValues = useRiskClassificationScores();

  const [params, setParams] = useState<CommonParams>({
    ...DEFAULT_PARAMS_STATE,
  });

  const parentUsersQueryResult = useUserEntityLinkedEntitiesParent(userId);

  const childUsersQueryResult = useUserEntityLinkedEntitiesChild(userId, params);

  const columns: TableColumn<AllUsersTableItem>[] = getAllUserColumns(
    settings.userAlias,
  ) as TableColumn<AllUsersTableItem>[];

  if (isRiskScoringEnabled) {
    columns.push(...getRiskScoringColumns(riskClassificationValues));
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
