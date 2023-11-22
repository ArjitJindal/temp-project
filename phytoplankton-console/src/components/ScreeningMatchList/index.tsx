import React, { useMemo } from 'react';
import { MatchListDropdown } from './MatchListDropdown';
import { Alert, SanctionsDetails } from '@/apis';
import Tabs, { TabItem } from '@/components/library/Tabs';
import { success } from '@/utils/asyncResource';
import Checklist from '@/pages/case-management/AlertTable/ExpandedRowRenderer/AlertExpanded/Checklist';
import Comments from '@/pages/case-management/AlertTable/ExpandedRowRenderer/AlertExpanded/Comments';

interface Props {
  details: SanctionsDetails[];
  alert?: Alert;
}

export default function ScreeningMatchList(props: Props) {
  const { details, alert } = props;

  const tabs: TabItem[] = useMemo(() => {
    return [
      {
        title: 'Match list',
        key: 'match_list',
        children: <MatchListDropdown details={details} />,
      },
      ...(alert != null && alert.alertId != null
        ? [
            ...(alert.ruleChecklistTemplateId
              ? [
                  {
                    title: 'Checklist',
                    key: 'checklist',
                    children: <Checklist alert={alert} />,
                  },
                ]
              : []),
            {
              title: 'Comments',
              key: 'comments',
              children: <Comments alertsRes={success(alert)} alertId={alert.alertId} />,
            },
          ]
        : []),
    ];
  }, [details, alert]);

  return <Tabs type="line" items={tabs} />;
}
