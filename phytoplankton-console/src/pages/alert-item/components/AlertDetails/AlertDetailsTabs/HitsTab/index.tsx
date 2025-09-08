import { useState } from 'react';
import SanctionDetailSelect from '../SanctionDetailSelect';
import SanctionsHitsTable from '@/components/SanctionsHitsTable';
import { Alert, SanctionsDetails, SanctionsHit, SanctionsHitStatus } from '@/apis';
import {
  SanctionsHitsTableParams,
  useSanctionHitsQuery,
} from '@/pages/alert-item/components/AlertDetails/AlertDetailsTabs/helpers';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { SelectionInfo } from '@/components/library/Table';
import { AllParams, SelectionAction } from '@/components/library/Table/types';

interface Props {
  alert?: Alert;
  status: SanctionsHitStatus;
  selectedSanctionsHitsIds?: string[];
  fitHeight?: boolean;
  onSanctionsHitSelect?: (sanctionsHitsIds: string[]) => void;
  onSanctionsHitsChangeStatus?: (sanctionsHitsIds: string[], newStatus: SanctionsHitStatus) => void;
  selectionInfo?: SelectionInfo;
  selectionActions?: SelectionAction<SanctionsHit, SanctionsHitsTableParams>[];
}

export default function HitsTab(props: Props) {
  const {
    alert,
    status,
    selectedSanctionsHitsIds,
    fitHeight,
    onSanctionsHitSelect,
    onSanctionsHitsChangeStatus,
    selectionInfo,
    selectionActions,
  } = props;
  const sanctionDetails = alert?.ruleHitMeta?.sanctionsDetails ?? [];
  const [selectedItem, setSelectedItem] = useState<SanctionsDetails | undefined>(
    sanctionDetails[0],
  );

  const [params, setParams] = useState<AllParams<SanctionsHitsTableParams>>(DEFAULT_PARAMS_STATE);

  const queryResult = useSanctionHitsQuery(
    {
      ...params,
      statuses: [status],
      searchIds: selectedItem?.searchId ? [selectedItem.searchId] : undefined,
      paymentMethodIds: selectedItem?.hitContext?.paymentMethodId
        ? [selectedItem.hitContext.paymentMethodId]
        : undefined,
      entityType: selectedItem?.entityType,
    },
    alert?.alertId,
  );

  return (
    <>
      {selectedItem && (
        <SanctionDetailSelect
          sanctionDetails={sanctionDetails}
          selectedItem={selectedItem}
          setSelectedItem={setSelectedItem}
        />
      )}
      <SanctionsHitsTable
        tableRef={null}
        queryResult={queryResult}
        hideCleaningReason={true}
        selectedIds={selectedSanctionsHitsIds}
        selection={onSanctionsHitSelect != null}
        onSelect={onSanctionsHitSelect}
        onSanctionsHitsChangeStatus={onSanctionsHitsChangeStatus}
        alertCreatedAt={alert?.createdTimestamp}
        selectionInfo={selectionInfo}
        selectionActions={selectionActions}
        fitHeight={fitHeight}
        showComment={true}
        params={params}
        onChangeParams={setParams}
      />
    </>
  );
}
