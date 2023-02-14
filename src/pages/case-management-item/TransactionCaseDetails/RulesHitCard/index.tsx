import { UI_SETTINGS } from '../ui-settings';
import * as Card from '@/components/ui/Card';
import Table from '@/components/ui/Table';
import { HitRulesDetails } from '@/apis';
import { RuleActionStatus } from '@/components/ui/RuleActionStatus';

interface Props {
  rulesHit: HitRulesDetails[];
  updateCollapseState: (key: string, value: boolean) => void;
}

export default function RulesHitCard(props: Props) {
  const { rulesHit, updateCollapseState } = props;
  return (
    <Card.Root
      header={{
        title: UI_SETTINGS.cards.RULES_HITS.title,
        collapsableKey: UI_SETTINGS.cards.RULES_HITS.key,
      }}
      updateCollapseState={updateCollapseState}
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
            items: rulesHit,
          }}
        />
      </Card.Section>
    </Card.Root>
  );
}
