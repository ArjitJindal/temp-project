import { useState } from 'react';
import * as Card from '@/components/ui/Card';
import { Case } from '@/apis';
import AlertTable, { AlertTableParams } from '@/pages/case-management/AlertTable';
import { DEFAULT_PARAMS_STATE } from '@/components/ui/Table';

interface Props {
  caseItem: Case;
  updateCollapseState: (key: string, value: boolean) => void;
  title: string;
  collapsableKey: string;
}

export default function AlertsCard(props: Props) {
  const { caseItem, updateCollapseState, title, collapsableKey } = props;

  const caseId = caseItem.caseId as string;
  const [params, setParams] = useState<AlertTableParams>({
    ...DEFAULT_PARAMS_STATE,
    caseId,
    sort: [['caseCreatedTimestamp', 'descend']],
    showCases: 'ALL_ALERTS',
  });

  return (
    <Card.Root header={{ title, collapsableKey }} updateCollapseState={updateCollapseState}>
      <Card.Section>
        <AlertTable
          params={params}
          onChangeParams={setParams}
          hideCaseIdFilter={true}
          hideScopeSelector={true}
          disableInternalPadding={true}
        />
      </Card.Section>
    </Card.Root>
  );
}
