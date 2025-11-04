import React, { useState } from 'react';
import { compact, startCase } from 'lodash';
import { COPILOT_QUESTIONS } from '@flagright/lib/utils';
import { humanizeAuto, capitalizeWordsInternal } from '@flagright/lib/utils/humanize';
import PdfTable from './PdfTable';
import {
  QuestionResponseEmbedded,
  QuestionResponseTable,
} from '@/pages/case-management/AlertTable/InvestigativeCoPilotModal/InvestigativeCoPilot/types';

import { Recommendation } from '@/pages/case-management/AlertTable/InvestigativeCoPilotModal/InvestigativeCoPilot/History/HistoryItem/HistoryItemEmbedded/Recommendation';
import { getOr } from '@/utils/asyncResource';
import { DEFAULT_PARAMS_STATE } from '@/components/library/Table/consts';
import { AllParams } from '@/components/library/Table/types';
import { SanctionsHitsTableParams } from '@/pages/alert-item/components/AlertDetails/AlertDetailsTabs/helpers';
import { useAlertDetails } from '@/utils/api/alerts';
import { useSanctionHitsQuery } from '@/utils/api/screening';

interface Props {
  item: QuestionResponseEmbedded;
}

const PdfSanctionsHitsTable: React.FC<{ alertId: string; type: 'OPEN' | 'CLEARED' }> = ({
  alertId,
  type,
}) => {
  const alertResponse = useAlertDetails(alertId);

  const alertData = getOr(alertResponse.data, null);

  const [params] = useState<AllParams<SanctionsHitsTableParams>>({
    ...DEFAULT_PARAMS_STATE,
    statuses: [type],
    searchIds: compact(alertData?.ruleHitMeta?.sanctionsDetails?.map((detail) => detail.searchId)),
    paymentMethodIds: compact(
      alertData?.ruleHitMeta?.sanctionsDetails?.map((detail) => detail.hitContext?.paymentMethodId),
    ),
  });

  const hitsQueryResults = useSanctionHitsQuery(params, alertId);
  const hitsData = getOr(hitsQueryResults.data, null);

  const tableData: QuestionResponseTable = {
    questionType: 'TABLE',
    questionId: '',
    variableOptions: [],
    title: `${type} Sanctions Hits`,
    variables: [],
    headers: [
      { name: 'Hit ID', columnType: 'STRING' },
      { name: 'Name', columnType: 'STRING' },
      { name: 'Countries', columnType: 'STRING' },
      { name: 'Matched Types', columnType: 'STRING' },
      { name: 'Relevance', columnType: 'STRING' },
      { name: 'Status', columnType: 'STRING' },
      { name: 'Comment', columnType: 'STRING' },
    ],
    rows: [],
  };

  if (!hitsData?.items || hitsData.items.length === 0) {
    tableData.rows = [['No data available', '', '', '', '', '', '']];
  } else {
    tableData.rows = hitsData.items.map((hit) => [
      hit.sanctionsHitId || '',
      capitalizeWordsInternal(hit.entity?.name ?? ''),
      compact(hit.entity?.countries)?.join(', ') || '-',
      hit.entity?.matchTypes?.map((matchType) => startCase(matchType)).join(', ') || '-',
      compact(hit.entity?.types)
        ?.map((type) => humanizeAuto(type))
        .join(', ') || '-',
      hit.status || '',
      hit.comment || '-',
    ]);
  }

  return (
    <div>
      <h4>{type === 'OPEN' ? 'Open' : 'Cleared'} Sanctions Hits</h4>
      <PdfTable item={tableData} />
      {tableData.rows.length > 0 && tableData.rows[0][0] !== 'No data available' && (
        <div style={{ marginTop: '8px', fontSize: '11px', color: '#666' }}>
          Total: {tableData.rows.length} {type.toLowerCase()} hit
          {tableData.rows.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
};

const PdfEmbedded: React.FC<Props> = ({ item }) => {
  const alertId = item.variables?.find((v) => v.name === 'alertId')?.value;

  if (
    item.questionId === COPILOT_QUESTIONS.OPEN_HITS ||
    item.questionId === COPILOT_QUESTIONS.CLEARED_HITS
  ) {
    return (
      <div>
        <PdfSanctionsHitsTable
          alertId={alertId as string}
          type={item.questionId === COPILOT_QUESTIONS.OPEN_HITS ? 'OPEN' : 'CLEARED'}
        />
      </div>
    );
  }

  if (item.questionId === COPILOT_QUESTIONS.RECOMMENDATION && typeof alertId === 'string') {
    return <Recommendation alertId={alertId} pdfMode />;
  }

  return null;
};

export default PdfEmbedded;
