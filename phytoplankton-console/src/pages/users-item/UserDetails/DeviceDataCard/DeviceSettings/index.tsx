import styles from './index.module.less';
import { H4 } from '@/components/ui/Typography';

type Props = {
  deviceSettings: { title: string; value: string | React.ReactNode }[];
};

export default function DeviceSettings(props: Props) {
  const { deviceSettings } = props;

  return (
    <div>
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
  );
}
