import { useState } from 'react';
import * as Card from '@/components/ui/Card';
import { Case } from '@/apis';
import { AlertTableParams } from '@/pages/case-management/AlertTable';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import AlertTableWrapper from '@/pages/case-management/AlertTable/AlertTableWrappper';

interface Props {
  caseItem: Case;
  title: string;
  expandedAlertId?: string;
}

export default function AlertsCard(props: Props) {
  const { caseItem, expandedAlertId } = props;

  const caseId = caseItem.caseId;
  const [params, setParams] = useState<AlertTableParams>({
    ...DEFAULT_PARAMS_STATE,
    caseId,
    sort: [['caseCreatedTimestamp', 'descend']],
    showCases: 'ALL_ALERTS',
  });

  return (
    <Card.Root>
      <Card.Section>
        <AlertTableWrapper
          expandedAlertId={expandedAlertId}
          caseId={caseId}
          params={params}
          onChangeParams={setParams}
          isEmbedded={true}
          escalatedTransactionIds={caseItem.caseHierarchyDetails?.childTransactionIds ?? []}
        />
      </Card.Section>
    </Card.Root>
  );
}
