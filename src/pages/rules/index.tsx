import { Tabs } from 'antd';
import { useLocalStorageState } from 'ahooks';
import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import StepForm from './create-rule/index';
import MyRule from './my-rules';
import RequestNew from './request-new';
import PageWrapper from '@/components/PageWrapper';
import PageTabs from '@/components/ui/PageTabs';

const TableList = () => {
  const { rule = 'create-rule' } = useParams<'rule'>();
  const navigate = useNavigate();
  const [, setLocalStorageActiveTab] = useLocalStorageState('rule-active-tab', rule);
  useEffect(() => {
    setLocalStorageActiveTab(rule);
  }, [setLocalStorageActiveTab, rule]);
  return (
    <PageWrapper>
      <PageTabs
        activeKey={rule}
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
      </PageTabs>
    </PageWrapper>
  );
};

export default TableList;
