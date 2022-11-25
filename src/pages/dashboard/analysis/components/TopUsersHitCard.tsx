import { Card, Tabs } from 'antd';
import styles from '../style.module.less';
import header from './dashboardutils';
import HitsPerUserCard from './HitsPerUserCard';

const TopUsersHitCard = () => {
  return (
    <Card
      title={header('Top users by Transaction Hits')}
      bordered={false}
      bodyStyle={{ padding: 0 }}
    >
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
    </Card>
  );
};

export default TopUsersHitCard;
