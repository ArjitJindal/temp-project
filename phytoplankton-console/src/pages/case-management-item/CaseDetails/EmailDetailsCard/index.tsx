import Label from '@/components/library/Label';
import * as Card from '@/components/ui/Card';

interface Props {
  email: string;
}

export default function EmailDetailsCard(props: Props) {
  const { email } = props;

  return (
    <Card.Root>
      <Card.Section>
        <Label label="Email">
          <div>{email}</div>
        </Label>
      </Card.Section>
    </Card.Root>
  );
}
