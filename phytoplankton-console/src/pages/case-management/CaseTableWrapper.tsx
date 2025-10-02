import { TableSearchParams } from './types';
import CaseTable from './CaseTable';
import TableModalProvider, { ModalHandlers } from './components/TableModalProvider';
import CasesStatusChangeModal, {
  Props as CasesStatusChangeModalProps,
} from './components/CasesStatusChangeButton/CasesStatusChangeModal';
import AlertsStatusChangeModal, {
  Props as AlertsStatusChangeModalProps,
} from './components/AlertsStatusChangeButton/AlertsStatusChangeModal';
import { Case } from '@/apis';
import { useApi } from '@/api';
import { type PaginatedData } from '@/utils/queries/hooks';
import { AllParams } from '@/components/library/Table/types';
import { useCasesListPaginated } from '@/hooks/api/cases';
import { useRuleOptions } from '@/utils/rules';
import { useAuth0User } from '@/utils/user-utils';
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

  const _api = useApi({ debounce: 500 });
  const _auth0user = useAuth0User();

  const queryResults = useCasesListPaginated(params, { meta: { atf: true } });
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
