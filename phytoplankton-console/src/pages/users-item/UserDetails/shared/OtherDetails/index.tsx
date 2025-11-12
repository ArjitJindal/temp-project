import { InternalConsumerUser } from '@/apis/models/InternalConsumerUser';
import { InternalBusinessUser } from '@/apis/models/InternalBusinessUser';
import EntityPropertiesCard from '@/components/ui/EntityPropertiesCard';

interface Props {
  user: Partial<InternalBusinessUser> | Partial<InternalConsumerUser>;
}

export const OtherDetailsCard = (props: Props) => {
  const { user } = props;
  return (
    <EntityPropertiesCard
      title={'Other details'}
      items={[
        ...(user.productsEnabled?.length
          ? [
              {
                label: 'Products enabled',
                value: user.productsEnabled.map((product) => product.productName).join(', '),
              },
            ]
          : []),
      ]}
    />
  );
};
