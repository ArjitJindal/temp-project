import AlertsStatusChangeModal, {
  Props as AlertsStatusChangeModalProps,
} from '../components/AlertsStatusChangeButton/AlertsStatusChangeModal';
import TableModalProvider, { ModalHandlers } from '../components/TableModalProvider';
import AlertTable, { AlertTableParams } from '.';

interface Props {
  params: AlertTableParams;
  onChangeParams?: (newState: AlertTableParams) => void;
  isEmbedded?: boolean;
  showUserFilters?: boolean;
  caseId?: string;
  escalatedTransactionIds?: string[];
  expandTransactions?: boolean;
  showAssignedToFilter?: boolean;
  expandedAlertId?: string;
}

interface AlertTableChildrenProps extends ModalHandlers<AlertsStatusChangeModalProps>, Props {}
export default function AlertTableWrapper(props: Props) {
  return (
    <TableModalProvider<AlertsStatusChangeModalProps, AlertTableChildrenProps>
      ModalComponent={AlertsStatusChangeModal}
      childrenProps={props}
    >
      {(childrenProps) => (
        <AlertTable<AlertsStatusChangeModalProps>
          params={childrenProps.params}
          caseId={childrenProps.caseId}
          onChangeParams={childrenProps.onChangeParams}
          isEmbedded={childrenProps.isEmbedded}
          showUserFilters={childrenProps.showUserFilters}
          escalatedTransactionIds={childrenProps.escalatedTransactionIds}
          expandTransactions={childrenProps.expandTransactions}
          showAssignedToFilter={childrenProps.showAssignedToFilter}
          expandedAlertId={childrenProps.expandedAlertId}
          updateModalState={childrenProps.updateModalState}
          setModalVisibility={childrenProps.handleModalEvent}
        />
      )}
    </TableModalProvider>
  );
}
