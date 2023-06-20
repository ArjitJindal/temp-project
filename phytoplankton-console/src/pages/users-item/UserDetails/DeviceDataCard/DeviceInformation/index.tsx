import styles from './index.module.less';
import { H4 } from '@/components/ui/Typography';

type Props = {
  deviceInfo: { title: string; value: string | React.ReactNode }[];
};

export default function DeviceInformation(props: Props) {
  const { deviceInfo } = props;

  return (
    <div>
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
  );
}
