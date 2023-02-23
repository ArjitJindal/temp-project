import { InternalBusinessUser, InternalConsumerUser } from '@/apis';
import CountryDisplay from '@/components/ui/CountryDisplay';

interface Props {
  user: InternalBusinessUser | InternalConsumerUser | undefined;
}

export default function UserCountryDisplay(props: Props): JSX.Element {
  const { user } = props;
  if (user == null) {
    return <>-</>;
  }
  if (user.type === 'CONSUMER') {
    return <CountryDisplay isoCode={user.userDetails?.countryOfResidence} />;
  }
  return (
    <CountryDisplay isoCode={user.legalEntity.companyRegistrationDetails?.registrationCountry} />
  );
}
