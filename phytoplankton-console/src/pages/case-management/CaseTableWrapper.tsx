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
import { PaginatedData } from '@/utils/queries/hooks';
import { AllParams } from '@/components/library/Table/types';
import { useRuleOptions } from '@/utils/api/rules';
import { useAuth0User } from '@/utils/user-utils';
import { getStatuses } from '@/utils/case-utils';
import { QueryResult } from '@/utils/queries/types';
import { useCaseList } from '@/utils/api/cases';

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

  const auth0user = useAuth0User();
  const [sortField, sortOrder] = params.sort[0] ?? [];

  const queryResults = useCaseList({
    ...params,
    filterId: params.caseId,
    filterRulesHit: params.rulesHitFilter,
    filterRulesExecuted: params.rulesExecutedFilter,
    filterCaseStatus: getStatuses(params.caseStatus),
    filterUserId: params.userId,
    filterParentUserId: params.parentUserId,
    sortField: sortField ?? undefined,
    sortOrder: sortOrder ?? undefined,
    filterOriginPaymentMethods: params.originMethodFilter,
    filterDestinationPaymentMethods: params.destinationMethodFilter,
    filterTransactionTagKey: params.tagKey,
    filterTransactionTagValue: params.tagValue,
    filterBusinessIndustries: params.businessIndustryFilter,
    filterRiskLevel: params.riskLevels,
    filterCaseTypes: params.caseTypesFilter,
    filterUserState: params.userStates,
    filterRuleQueueIds: params.ruleQueueIds,
    filterRuleNature: params.ruleNature,
    filterAssignmentsIds:
      params.showCases === 'MY'
        ? [auth0user.userId]
        : params.assignedTo?.length
        ? params.assignedTo
        : undefined,
    filterAssignmentsRoles: params.roleAssignedTo?.length ? params.roleAssignedTo : undefined,
    ...(params.updatedAt && {
      filterCasesByLastUpdatedStartTimestamp: params.updatedAt
        ? dayjs(params.updatedAt[0]).valueOf()
        : 0,
      filterCasesByLastUpdatedEndTimestamp: params.updatedAt
        ? dayjs(params.updatedAt[1]).valueOf()
        : Number.MAX_SAFE_INTEGER,
    }),
    filterAlertPriority: params.alertPriority,
    filterCaseSlaPolicyId: params.filterCaseSlaPolicyId?.length
      ? params.filterCaseSlaPolicyId
      : undefined,
    filterCaseSlaPolicyStatus: params.filterCaseSlaPolicyStatus?.length
      ? params.filterCaseSlaPolicyStatus
      : undefined,
    filterCaseClosureReasons: params.filterClosingReason?.length
      ? params.filterClosingReason
      : undefined,
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
