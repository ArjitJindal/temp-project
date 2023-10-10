import React, { useMemo } from 'react';
import { MatchListDropdown } from './MatchListDropdown';
import { Alert, SanctionsDetails } from '@/apis';
import Tabs from '@/components/library/Tabs';
import { success } from '@/utils/asyncResource';
import Checklist from '@/pages/case-management/AlertTable/ExpandedRowRenderer/AlertExpanded/Checklist';
import Comments from '@/pages/case-management/AlertTable/ExpandedRowRenderer/AlertExpanded/Comments';

interface Props {
  details: SanctionsDetails[];
  alert?: Alert;
}

export default function ScreeningMatchList(props: Props) {
  const { details, alert } = props;

  const tabs = useMemo(() => {
    return [
      {
        tab: 'Match list',
        key: 'match_list',
        children: <MatchListDropdown details={details} />,
      },
      ...(alert != null && alert.alertId != null
        ? [
            ...(alert.ruleChecklistTemplateId
              ? [
                  {
                    tab: 'Checklist',
                    key: 'checklist',
                    children: <Checklist alert={alert} />,
                  },
                ]
              : []),
            {
              tab: 'Comments',
              key: 'comments',
              children: <Comments alertsRes={success(alert)} alertId={alert.alertId} />,
            },
          ]
        : []),
    ];
  }, [details, alert]);

  return <Tabs type="line" items={tabs} />;
}
