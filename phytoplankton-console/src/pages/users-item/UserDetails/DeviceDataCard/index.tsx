import { useMemo } from 'react';
import ReactCountryFlag from 'react-country-flag';
import { COUNTRIES } from '@flagright/lib/constants';
import LocationInfoCard from './LocationInfoCard';
import DeviceInformation from './DeviceInformation';
import DeviceSettings from './DeviceSettings';
import OtherInformation from './OtherInformation';
import * as Card from '@/components/ui/Card';
import { DeviceMetric } from '@/apis';
import LANGUAGES from '@/utils/languages';

type Props = {
  title: string;
  deviceData: Partial<DeviceMetric>;
};

const DeviceDataInternalCard = ({ deviceData }: { deviceData: Partial<DeviceMetric> }) => {
  const headValues: { title: string; value: string | React.ReactNode }[] = useMemo(
    () => [
      {
        title: 'IP Address',
        value: deviceData.ipAddress ?? 'N/A',
      },
      {
        title: 'Location',
        value: () => {
          const latitude = deviceData?.location?.latitude ?? '';
          const longitude = deviceData?.location?.longitude ?? '';

          return latitude && longitude ? (
            <span>
              {latitude} °N, {longitude} °E
            </span>
          ) : (
            'N/A'
          );
        },
      },
      {
        title: 'Country & Language',
        value: () => {
          const countryCode = deviceData.deviceCountryCode ?? '';
          const languageCode = deviceData.deviceLaungageCode ?? '';

          return (
            <div style={{ display: 'flex', flexDirection: 'row' }}>
              {countryCode && languageCode && (
                <>
                  <ReactCountryFlag
                    countryCode={countryCode ?? ''}
                    svg
                    style={{ width: '1.5rem', height: '1.5rem' }}
                  />
                  <div style={{ paddingLeft: '8px' }}>
                    {COUNTRIES[countryCode]},{' '}
                    {languageCode && languageCode in LANGUAGES ? LANGUAGES[languageCode] : '-'}
                  </div>
                </>
              )}
            </div>
          );
        },
      },
    ],
    [deviceData],
  );

  const deviceInfo: { title: string; value: string | React.ReactNode }[] = useMemo(
    () => [
      {
        title: 'Fingerprint',
        value: deviceData.deviceFingerprint ?? 'N/A',
      },
      {
        title: 'Storage / RAM',
        value:
          deviceData.mainTotalStorageInGb != null && deviceData.ramInGb != null ? (
            <span>
              {deviceData.mainTotalStorageInGb + 'GB'} / {deviceData.ramInGb + 'GB'}
            </span>
          ) : (
            'N/A'
          ),
      },
      {
        title: 'External storage',
        value:
          deviceData.externalTotalStorageInGb != null &&
          deviceData.externalFreeStorageInGb != null ? (
            <span>
              {deviceData.externalTotalStorageInGb + 'GB'} (
              {Math.round(
                (deviceData.externalFreeStorageInGb / deviceData.externalTotalStorageInGb) * 100,
              )}
              % free)
            </span>
          ) : (
            'N/A'
          ),
      },
      {
        title: 'Battery',
        value: deviceData.batteryLevel ? deviceData.batteryLevel + '%' : 'N/A',
      },
    ],
    [deviceData],
  );

  const otherInformation: { title: string; value: string | React.ReactNode }[] = useMemo(
    () => [
      {
        title: 'Number of contacts',
        value: deviceData.totalNumberOfContacts != null ? deviceData.totalNumberOfContacts : 'N/A',
      },
    ],
    [deviceData],
  );

  const deviceSettings: { title: string; value: string | React.ReactNode }[] = useMemo(
    () => [
      {
        title: 'Bluetooth',
        value: deviceData.isBluetoothActive ? 'Yes' : 'No',
      },
      {
        title: 'Network operator',
        value: deviceData.networkOperator ?? 'N/A',
      },
      {
        title: 'Data roaming',
        value: deviceData.isDataRoamingEnabled ? 'Yes' : 'No',
      },
      {
        title: 'Accessibility',
        value: deviceData.isAccessibilityEnabled ? 'Yes' : 'No',
      },
      {
        title: 'Virtual device',
        value: deviceData.isVirtualDevice ? 'Yes' : 'No',
      },
      {
        title: 'Root / Jailbreak',
        value: deviceData.isRooted ? 'Yes' : 'No',
      },
    ],
    [deviceData],
  );

  return (
    <Card.Root>
      <Card.Row>
        <Card.Column>
          <Card.Section>
            <LocationInfoCard deviceData={deviceData} headValues={headValues} />
          </Card.Section>
        </Card.Column>
      </Card.Row>

      <Card.Row>
        <Card.Column>
          <Card.Section>
            <DeviceInformation deviceInfo={deviceInfo} />
          </Card.Section>
        </Card.Column>

        <Card.Column>
          <Card.Section>
            <DeviceSettings deviceSettings={deviceSettings} />
          </Card.Section>
        </Card.Column>

        <Card.Column>
          <Card.Section>
            <OtherInformation otherInformation={otherInformation} />
          </Card.Section>
        </Card.Column>
      </Card.Row>
    </Card.Root>
  );
};

const DeviceDataCard = (props: Props) => {
  const { title, deviceData } = props;

  return (
    <Card.Root header={{ title }}>
      <DeviceDataInternalCard deviceData={deviceData != null ? deviceData : {}} />;
    </Card.Root>
  );
};

export default DeviceDataCard;
