import { Address as ApiAddress } from '@/apis';
import * as Card from '@/components/ui/Card';
import Address from '@/components/ui/Address';

interface Props {
  address: ApiAddress;
}

export default function AddressDetailsCard(props: Props) {
  const { address } = props;

  return (
    <Card.Root>
      <Card.Section>
        <Address address={address} />
      </Card.Section>
    </Card.Root>
  );
}
