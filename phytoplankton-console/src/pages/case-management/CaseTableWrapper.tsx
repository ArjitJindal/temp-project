import { TableSearchParams } from './types';
import CaseTable from './CaseTable';
import TableModalProvider, { ModalHandlers } from './components/TableModalProvider';
import CasesStatusChangeModal, {
  Props as CasesStatusChangeModalProps,
} from './components/CasesStatusChangeButton/CasesStatusChangeModal';
import AlertsStatusChangeModal, {
  Props as AlertsStatusChangeModalProps,
} from './components/AlertsStatusChangeButton/AlertsStatusChangeModal';
import { dayjs } from '@/utils/dayjs';
import { Case } from '@/apis';
import { useApi } from '@/api';
import { PaginatedData, usePaginatedQuery } from '@/utils/queries/hooks';
import { AllParams } from '@/components/library/Table/types';
import { CASES_LIST } from '@/utils/queries/keys';
import { useRuleOptions } from '@/utils/rules';
import { useAuth0User } from '@/utils/user-utils';
import { getStatuses } from '@/utils/case-utils';
import { QueryResult } from '@/utils/queries/types';

interface CaseTableChildrenProps extends ModalHandlers<CasesStatusChangeModalProps> {
  params: AllParams<TableSearchParams>;
  queryResult: QueryResult<PaginatedData<Case>>;
  onChangeParams: (newState: AllParams<TableSearchParams>) => void;
  rules: { value: string; label: string }[];
  showAssignedToFilter: boolean;
}

export default function CaseTableWrapper(props: {
  params: TableSearchParams;
  onChangeParams: (newState: AllParams<TableSearchParams>) => void;
}) {
  const { params, onChangeParams } = props;

  const api = useApi({ debounce: 500 });
  const auth0user = useAuth0User();

  const queryResults = usePaginatedQuery<Case>(CASES_LIST(params), async (paginationParams) => {
    const {
      sort,
      page,
      pageSize,
      view,
      createdTimestamp,
      caseId,
      rulesHitFilter,
      rulesExecutedFilter,
      userId,
      originMethodFilter,
      destinationMethodFilter,
      tagKey,
      tagValue,
      caseStatus,
      businessIndustryFilter,
      riskLevels,
      userStates,
      showCases,
      assignedTo,
      roleAssignedTo,
      updatedAt,
      caseTypesFilter,
      ruleQueueIds,
      alertPriority,
      ruleNature,
      filterCaseSlaPolicyId,
      filterCaseSlaPolicyStatus,
    } = params;

    const [sortField, sortOrder] = sort[0] ?? [];

    const response = await api.getCaseList({
      page,
      pageSize,
      view,
      ...paginationParams,
      afterTimestamp: createdTimestamp ? dayjs(createdTimestamp[0]).valueOf() : 0,
      beforeTimestamp: createdTimestamp
        ? dayjs(createdTimestamp[1]).valueOf()
        : Number.MAX_SAFE_INTEGER,
      filterId: caseId,
      filterRulesHit: rulesHitFilter,
      filterRulesExecuted: rulesExecutedFilter,
      filterCaseStatus: getStatuses(caseStatus),
      filterUserId: userId,
      sortField: sortField ?? undefined,
      sortOrder: sortOrder ?? undefined,
      filterOriginPaymentMethods: originMethodFilter,
      filterDestinationPaymentMethods: destinationMethodFilter,
      filterTransactionTagKey: tagKey,
      filterTransactionTagValue: tagValue,
      filterBusinessIndustries: businessIndustryFilter,
      filterRiskLevel: riskLevels,
      filterCaseTypes: caseTypesFilter,
      filterUserState: userStates,
      filterRuleQueueIds: ruleQueueIds,
      filterRuleNature: ruleNature,
      filterAssignmentsIds:
        showCases === 'MY' ? [auth0user.userId] : assignedTo?.length ? assignedTo : undefined,
      filterAssignmentsRoles: roleAssignedTo?.length ? roleAssignedTo : undefined,
      ...(updatedAt && {
        filterCasesByLastUpdatedStartTimestamp: updatedAt ? dayjs(updatedAt[0]).valueOf() : 0,
        filterCasesByLastUpdatedEndTimestamp: updatedAt
          ? dayjs(updatedAt[1]).valueOf()
          : Number.MAX_SAFE_INTEGER,
      }),
      filterAlertPriority: alertPriority,
      filterCaseSlaPolicyId: filterCaseSlaPolicyId?.length ? filterCaseSlaPolicyId : undefined,
      filterCaseSlaPolicyStatus: filterCaseSlaPolicyStatus?.length
        ? filterCaseSlaPolicyStatus
        : undefined,
    });

    return {
      total: response.total,
      items: response.data,
    };
  });
  const ruleOptions = useRuleOptions();

  return (
    <TableModalProvider<CasesStatusChangeModalProps, CaseTableChildrenProps>
      ModalComponent={CasesStatusChangeModal}
      childrenProps={{
        params,
        queryResult: queryResults,
        onChangeParams,
        rules: ruleOptions.filter(Boolean) as { value: string; label: string }[],
        showAssignedToFilter: params.showCases === 'MY' ? false : true,
      }}
    >
      {(firstProviderChildrenProps) => (
        <TableModalProvider<AlertsStatusChangeModalProps, CaseTableChildrenProps>
          ModalComponent={AlertsStatusChangeModal}
          childrenProps={firstProviderChildrenProps}
        >
          {(secondProviderChildrenProps) => (
            <CaseTable<CasesStatusChangeModalProps, AlertsStatusChangeModalProps>
              params={secondProviderChildrenProps.params}
              onChangeParams={secondProviderChildrenProps.onChangeParams}
              queryResult={secondProviderChildrenProps.queryResult}
              rules={secondProviderChildrenProps.rules}
              showAssignedToFilter={secondProviderChildrenProps.showAssignedToFilter}
              updateFirstModalState={firstProviderChildrenProps.updateModalState}
              setFirstModalVisibility={firstProviderChildrenProps.handleModalEvent}
              updateSecondModalState={secondProviderChildrenProps.updateModalState}
              setSecondModalVisibility={secondProviderChildrenProps.handleModalEvent}
            />
          )}
        </TableModalProvider>
      )}
    </TableModalProvider>
  );
}
