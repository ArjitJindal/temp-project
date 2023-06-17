import styles from './index.module.less';
import { H4 } from '@/components/ui/Typography';

type Props = {
  otherInformation: { title: string; value: string | React.ReactNode }[];
};

export default function OtherInformation(props: Props) {
  const { otherInformation } = props;

  return (
    <div>
      <H4>Other information</H4>
      <div className={styles.deviceSettings}>
        {otherInformation.map((item) => (
          <div className={styles.device}>
            <div className={styles.device_title}>{item.title}</div>
            <div className={styles.device_value}>{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
