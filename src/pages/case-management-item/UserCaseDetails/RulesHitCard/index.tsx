import React, { useState } from 'react';
import { Collapse } from 'antd';
import NoData from '../InsightsCard/components/NoData';
import CollapseHeader from './CollapseHeader';
import s from './styles.module.less';
import RulesHitTransactionTable from './RulesHitTransactionsTable';
import * as Card from '@/components/ui/Card';
import { Case, RulesHitPerCase } from '@/apis';
import { useQuery } from '@/utils/queries/hooks';
import { CASES_ITEM_RULES } from '@/utils/queries/keys';
import { useApi } from '@/api';
import AsyncResourceRenderer from '@/components/common/AsyncResourceRenderer';
import { useApiTime } from '@/utils/tracker';

interface Props {
  caseItem: Case;
  updateCollapseState: (key: string, value: boolean) => void;
  title: string;
  collapsableKey: string;
}

export default function RulesHitCard(props: Props) {
  const { caseItem, updateCollapseState, title, collapsableKey } = props;

  const api = useApi();
  const caseId = caseItem.caseId as string;
  const measure = useApiTime();

  const [selectedInstanceId, setSelectedInstanceId] = useState<string | string[]>('');

  const rulesQueryResults = useQuery(
    CASES_ITEM_RULES(caseId),
    (): Promise<RulesHitPerCase[]> => measure(() => api.getCaseRules({ caseId }), 'Get Case Rules'),
  );

  const onChange = (key: string | string[]) => {
    setSelectedInstanceId(key);
  };

  return (
    <Card.Root header={{ title, collapsableKey }} updateCollapseState={updateCollapseState}>
      <Card.Section>
        <AsyncResourceRenderer resource={rulesQueryResults.data}>
          {(response) => {
            if (response.length === 0) {
              return <NoData />;
            }

            return (
              <Collapse
                onChange={onChange}
                bordered={true}
                className={s.customCollapse}
                ghost
                accordion
              >
                {response.map((hitRuleDetails) => {
                  return (
                    <Collapse.Panel
                      header={<CollapseHeader hitRuleDetails={hitRuleDetails} />}
                      key={hitRuleDetails.ruleInstanceId as string}
                      className={s.panel}
                      forceRender
                    >
                      <RulesHitTransactionTable
                        caseItem={caseItem}
                        rulesInstanceId={selectedInstanceId}
                      />
                    </Collapse.Panel>
                  );
                })}
              </Collapse>
            );
          }}
        </AsyncResourceRenderer>
      </Card.Section>
    </Card.Root>
  );
}
