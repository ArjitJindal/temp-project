import { useMemo } from 'react';
import ReactCountryFlag from 'react-country-flag';
import styles from './index.module.less';
import * as Card from '@/components/ui/Card';
import SmartPhoneLine from '@/components/ui/icons/Remix/device/smartphone-line.react.svg';
import { H4 } from '@/components/ui/Typography';
import { DeviceMetric } from '@/apis';
import COUNTRIES from '@/utils/countries';
import LANGUAGES, { LanguageCode } from '@/utils/languages';

type Props = {
  updateCollapseState?: (key: string, value: boolean) => void;
  title: string;
  collapsableKey: string;
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
        value:
          deviceData?.location?.latitude && deviceData?.location?.longitude ? (
            <span>
              {deviceData?.location?.latitude} °N, {deviceData?.location?.longitude} °E
            </span>
          ) : (
            'N/A'
          ),
      },
      {
        title: 'Country & Language',
        value: (
          <div style={{ display: 'flex', flexDirection: 'row' }}>
            {deviceData.deviceCountryCode && deviceData.deviceLaungageCode && (
              <>
                <ReactCountryFlag
                  countryCode={deviceData.deviceCountryCode ?? ''}
                  svg
                  style={{ width: '1.5rem', height: '1.5rem' }}
                />
                <div style={{ paddingLeft: '8px' }}>
                  {COUNTRIES[deviceData.deviceCountryCode]},{' '}
                  {deviceData.deviceLaungageCode
                    ? LANGUAGES[deviceData.deviceLaungageCode as LanguageCode]
                    : '-'}
                </div>
              </>
            )}
          </div>
        ),
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

  const otherSettings: { title: string; value: string | React.ReactNode }[] = useMemo(
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
    <div className={styles.card}>
      <div className={styles.card_head}>
        <div className={styles.device_brand_info}>
          <div className={styles.device_logo}>
            <SmartPhoneLine width={24} height={24} />
          </div>
          <div className={styles.device_name}>
            <div className={styles.device_brand}>
              {deviceData.manufacturer ?? 'Unknown'}, {deviceData.model ?? 'Unknown'}
            </div>
            <div className={styles.device_model}>
              {deviceData?.operatingSystem?.name} {deviceData?.operatingSystem?.version}
            </div>
          </div>
        </div>
        {headValues.map((item) => (
          <div className={styles.device}>
            <div className={styles.device_title}>{item.title}</div>
            <div className={styles.device_value}>{item.value}</div>
          </div>
        ))}
      </div>
      <div className={styles.card_body}>
        <div className={styles.card_body_0}>
          <H4>Device information</H4>
          <div className={styles.deviceInfo}>
            {deviceInfo.map((item) => (
              <div className={styles.device}>
                <div className={styles.device_title}>{item.title}</div>
                <div className={styles.device_value}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.card_body_1}>
          <H4>Device settings</H4>
          <div className={styles.deviceSettings}>
            {deviceSettings.map((item) => (
              <div className={styles.device}>
                <div className={styles.device_title}>{item.title}</div>
                <div className={styles.device_value}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.card_body_2}>
          <H4>Other information</H4>
          <div className={styles.otherSettings}>
            {otherSettings.map((item) => (
              <div className={styles.device}>
                <div className={styles.device_title}>{item.title}</div>
                <div className={styles.device_value}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const DeviceDataCard = (props: Props) => {
  const { updateCollapseState, title, collapsableKey, deviceData } = props;

  return (
    <Card.Root header={{ title, collapsableKey }} updateCollapseState={updateCollapseState}>
      <DeviceDataInternalCard deviceData={deviceData != null ? deviceData : {}} />;
    </Card.Root>
  );
};

export default DeviceDataCard;
