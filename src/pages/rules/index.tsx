import { Tabs } from 'antd';
import { useLocalStorageState } from 'ahooks';
import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import styles from './create-rule/style.module.less';
import StepForm from './create-rule/index';
import MyRule from './my-rules';
import RequestNew from './request-new';
import PageWrapper from '@/components/PageWrapper';

const TableList = () => {
  const { rule = 'create-rule' } = useParams<'rule'>();
  const navigate = useNavigate();
  const [, setLocalStorageActiveTab] = useLocalStorageState('rule-active-tab', rule);
  useEffect(() => {
    setLocalStorageActiveTab(rule);
  }, [setLocalStorageActiveTab, rule]);
  return (
    <PageWrapper>
      <div className={styles.tab}>
        <Tabs
          type="line"
          activeKey={rule}
          destroyInactiveTabPane={true}
          onChange={(key) => {
            navigate(`/rules/${key}`, { replace: true });
          }}
        >
          <Tabs.TabPane tab="Create Rule" key="create-rule">
            <StepForm />
          </Tabs.TabPane>
          <Tabs.TabPane tab="My Rules" key="my-rules">
            <MyRule />
          </Tabs.TabPane>
          <Tabs.TabPane tab="Request New" key="request-new">
            <RequestNew />
          </Tabs.TabPane>
        </Tabs>
      </div>
    </PageWrapper>
  );
};

export default TableList;
