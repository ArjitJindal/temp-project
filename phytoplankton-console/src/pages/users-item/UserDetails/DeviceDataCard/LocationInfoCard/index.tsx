import styles from './index.module.less';
import { DeviceMetric } from '@/apis';
import SmartPhoneLine from '@/components/ui/icons/Remix/device/smartphone-line.react.svg';

type Props = {
  deviceData: Partial<DeviceMetric>;
  headValues: { title: string; value: string | React.ReactNode }[];
};
export default function LocationInfoCard(props: Props) {
  const { deviceData, headValues } = props;

  return (
    <div className={styles.card_layout}>
      <div className={styles.device_overview}>
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
  );
}
