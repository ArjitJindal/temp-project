import React from 'react';
import * as Card from '@/components/ui/Card';
import Table from '@/components/ui/Table';
import { HitRulesResult } from '@/apis';
import { RuleActionStatus } from '@/components/ui/RuleActionStatus';

interface Props {
  rulesHit: HitRulesResult[];
}

export default function UserDetailsCard(props: Props) {
  const { rulesHit } = props;
  return (
    <Card.Root
      header={{
        title: 'Rules Hit',
        collapsable: true,
        collapsedByDefault: false,
      }}
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
          data={{ items: rulesHit }}
        />
      </Card.Section>
    </Card.Root>
  );
}
