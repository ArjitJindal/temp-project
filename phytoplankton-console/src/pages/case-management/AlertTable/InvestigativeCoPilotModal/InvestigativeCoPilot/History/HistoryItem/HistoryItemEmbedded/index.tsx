import React, { useState } from 'react';
import { COPILOT_QUESTIONS } from '@flagright/lib/utils';
import { QuestionResponseEmbedded } from '../../../types';
import { Recommendation } from './Recommendation';
import * as Card from '@/components/ui/Card';
import Linking from '@/pages/users-item/UserDetails/Linking';
import SanctionsHitsTable from '@/components/SanctionsHitsTable';
import { AllParams } from '@/components/library/Table/types';
import { getOr } from '@/utils/asyncResource';
import { useQuery } from '@/utils/queries/hooks';
import { useApi } from '@/api';
import { ALERT_ITEM } from '@/utils/queries/keys';
import {
  SanctionsHitsTableParams,
  updateSanctionsData,
  useChangeSanctionsHitsStatusMutation,
  useSanctionHitsQuery,
} from '@/components/ScreeningMatchList/helpers';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { adaptMutationVariables } from '@/utils/queries/mutations/helpers';
import SanctionsHitStatusChangeModal from '@/pages/case-management/AlertTable/SanctionsHitStatusChangeModal';
import Button from '@/components/library/Button';
import Portal from '@/components/library/Portal';

interface Props {
  item: QuestionResponseEmbedded;
}

export default function HistoryItemEmbedded({ item }: Props) {
  const userId = item.variables?.find((v) => v.name === 'userId')?.value;
  const alertId = item.variables?.find((v) => v.name === 'alertId')?.value;

  if (
    (item.questionId === COPILOT_QUESTIONS.OPEN_HITS ||
      item.questionId === COPILOT_QUESTIONS.CLEARED_HITS) &&
    typeof alertId === 'string'
  ) {
    return (
      <div>
        <HitsTable
          alertId={alertId}
          type={item.questionId === COPILOT_QUESTIONS.OPEN_HITS ? 'OPEN' : 'CLEARED'}
        />
      </div>
    );
  }

  return (
    <Card.Section key={JSON.stringify(item.variables)}>
      {item.questionId === COPILOT_QUESTIONS.ONTOLOGY && typeof userId === 'string' && (
        <div style={{ height: '400px' }}>
          <Linking userId={userId} />
        </div>
      )}
      {item.questionId === COPILOT_QUESTIONS.RECOMMENDATION && typeof alertId === 'string' && (
        <Recommendation alertId={alertId} />
      )}
    </Card.Section>
  );
}

export const HitsTable = ({ alertId, type }: { alertId: string; type: 'OPEN' | 'CLEARED' }) => {
  const api = useApi();
  const alertResponse = useQuery(ALERT_ITEM(alertId), async () => {
    if (!alertId) {
      throw new Error(`Unable to fetch alert, id is empty`);
    }
    return api.getAlert({ alertId });
  });
  const [params, setParams] = useState<AllParams<SanctionsHitsTableParams>>({
    ...DEFAULT_PARAMS_STATE,
    statuses: [type],
  });
  const alertData = getOr(alertResponse.data, null);
  const openHitsQueryResults = useSanctionHitsQuery(params, alertId);
  const [selectedSanctionsHitsIds, setSelectedSanctionsHitsIds] = useState<string[]>([]);
  const [isStatusChangeModalVisible, setStatusChangeModalVisible] = useState(false);
  const { changeHitsStatusMutation } = useChangeSanctionsHitsStatusMutation();

  return (
    <>
      <SanctionsHitsTable
        tableRef={null}
        queryResult={openHitsQueryResults}
        hideCleaningReason={true}
        selectedIds={selectedSanctionsHitsIds}
        selection={selectedSanctionsHitsIds != null}
        params={params}
        onChangeParams={setParams}
        onSelect={(sanctionHitsIds) => {
          setSelectedSanctionsHitsIds(sanctionHitsIds);
        }}
        showComment={true}
        onSanctionsHitsChangeStatus={() => {
          setStatusChangeModalVisible(true);
        }}
        alertCreatedAt={alertData?.createdTimestamp}
        selectionActions={[
          () => (
            <Button onClick={() => setStatusChangeModalVisible(true)}>
              {type === 'OPEN' ? 'Clear' : 'Re-open'}
            </Button>
          ),
        ]}
      />
      <Portal>
        <SanctionsHitStatusChangeModal
          entityIds={selectedSanctionsHitsIds}
          isVisible={isStatusChangeModalVisible}
          onClose={() => setStatusChangeModalVisible(false)}
          newStatus={type === 'OPEN' ? 'CLEARED' : 'OPEN'}
          updateMutation={adaptMutationVariables(changeHitsStatusMutation, (formValues) =>
            updateSanctionsData(formValues, {
              [alertId]: selectedSanctionsHitsIds.map((id) => ({ id })),
            }),
          )}
        />
      </Portal>
    </>
  );
};
