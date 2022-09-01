import { Tabs, TabsProps } from 'antd';
import styles from './index.module.less';

interface Props extends TabsProps {}

export default function PageTabs(props: Props) {
  return (
    <Tabs className={styles.root} type="line" destroyInactiveTabPane={true} {...props}>
      {props.children}
    </Tabs>
  );
}
