import { Tabs } from 'antd';
import styles from '../style.module.less';
import HitsPerUserCard from './HitsPerUserCard';

const TopUsersHitCard = () => {
  return (
    <div className={styles.salesCard}>
      <Tabs defaultActiveKey="all" type="card">
        <Tabs.TabPane tab="All users" key="all">
          <HitsPerUserCard />
        </Tabs.TabPane>
        <Tabs.TabPane tab="Senders" key="senders">
          <HitsPerUserCard direction="ORIGIN" />
        </Tabs.TabPane>
        <Tabs.TabPane tab="Receivers" key="receivers">
          <HitsPerUserCard direction="DESTINATION" />
        </Tabs.TabPane>
      </Tabs>
    </div>
  );
};

export default TopUsersHitCard;
