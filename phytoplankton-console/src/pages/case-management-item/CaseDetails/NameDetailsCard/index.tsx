import Label from '@/components/library/Label';
import * as Card from '@/components/ui/Card';

interface Props {
  name: string;
}

export default function NameDetailsCard(props: Props) {
  const { name } = props;

  return (
    <Card.Root>
      <Card.Section>
        <Label label="Name">
          <div>{name}</div>
        </Label>
      </Card.Section>
    </Card.Root>
  );
}
