import React from 'react';
import { ExpandTabRef } from '../../UserCaseDetails';
import * as Card from '@/components/ui/Card';
import Table from '@/components/ui/Table';
import { HitRulesResult } from '@/apis';
import { RuleActionStatus } from '@/components/ui/RuleActionStatus';
import { filterRulesHitByCaseCreationType } from '@/utils/rules';

interface Props {
  rulesHit: HitRulesResult[];
  reference?: React.Ref<ExpandTabRef>;
  updateCollapseState: (key: string, value: boolean) => void;
}

export default function RulesHitCard(props: Props) {
  const { rulesHit, updateCollapseState } = props;
  return (
    <Card.Root
      header={{ title: 'Rules Hits', collapsable: true, collapsedByDefault: true }}
      ref={props.reference}
      onCollapseChange={(isCollapsed) => updateCollapseState('rulesHit', isCollapsed)}
    >
      <Card.Section>
        <Table
          rowKey="ruleId"
          options={{
            reload: false,
            setting: false,
            density: false,
          }}
          search={false}
          pagination={false}
          disableInternalPadding={true}
          columns={[
            { title: 'Rules hit', render: (_, entity) => entity.ruleName },
            { title: 'Rules parameters matched', render: (_, entity) => entity.ruleDescription },
            {
              title: 'Rule Action',
              render: (_, entity) => <RuleActionStatus ruleAction={entity.ruleAction} />,
            },
          ]}
          data={{
            items: filterRulesHitByCaseCreationType(rulesHit, 'TRANSACTION'),
          }}
        />
      </Card.Section>
    </Card.Root>
  );
}
