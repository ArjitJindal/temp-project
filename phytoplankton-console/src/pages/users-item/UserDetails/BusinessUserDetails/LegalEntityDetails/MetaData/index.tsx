import { InternalBusinessUser } from '@/apis';
import EntityPropertiesCard from '@/components/ui/EntityPropertiesCard';
import CountryDisplay from '@/components/ui/CountryDisplay';

interface Props {
  user: InternalBusinessUser;
  columns?: number;
}

export default function MetaData(props: Props) {
  const { user, columns = 1 } = props;

  return (
    <EntityPropertiesCard
      title={'Metadata'}
      columns={columns}
      items={[
        {
          label: 'Battery level',
          value: user.metaData?.batteryLevel,
        },
        {
          label: 'Device latitude',
          value: user.metaData?.deviceLatitude,
        },
        {
          label: 'Device longitude',
          value: user.metaData?.deviceLongitude,
        },
        {
          label: 'IP address',
          value: user.metaData?.ipAddress,
        },
        {
          label: 'IP country',
          value: <CountryDisplay isoCode={user.metaData?.ipCountry} />,
        },
        {
          label: 'Device identifier',
          value: user.metaData?.deviceIdentifier,
        },
        {
          label: 'VPN used',
          value: user.metaData?.vpnUsed === undefined ? '-' : user.metaData?.vpnUsed ? 'Yes' : 'No',
        },
        { label: 'Operating system', value: user.metaData?.operatingSystem },
        {
          label: 'Device maker',
          value: user.metaData?.deviceMaker,
        },
        {
          label: 'Device model',
          value: user.metaData?.deviceModel,
        },
        {
          label: 'Device year',
          value: user.metaData?.deviceYear,
        },
        {
          label: 'App version',
          value: user.metaData?.appVersion,
        },
      ]}
    />
  );
}
