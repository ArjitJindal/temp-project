import * as Card from '@/components/ui/Card';
import { P } from '@/components/ui/Typography';

interface Props {
  ruleName: string | undefined;
  ruleDescription: string | undefined;
}

export default function NameAndDescription(props: Props) {
  const { ruleName, ruleDescription } = props;

  return (
    <Card.Root>
      <Card.Section>
        <div>
          <P variant="m" fontWeight="semibold">
            {ruleName}
          </P>
          <P variant="m">{ruleDescription}</P>
        </div>
      </Card.Section>
    </Card.Root>
  );
}
