import { Tabs } from 'antd';
import { useLocalStorageState } from 'ahooks';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ruleHeaderKeyToDescription } from './utils';
import StepForm from './create-rule/index';
import MyRule from './my-rules';
import PageWrapper from '@/components/PageWrapper';
import PageTabs from '@/components/ui/PageTabs';
import { useI18n } from '@/locales';

const TableList = () => {
  const { rule = 'rules-library' } = useParams<'rule'>();
  const navigate = useNavigate();
  const [currentHeaderId, setCurrentHeaderId] = useState<string>(`menu.rules.${rule}`);
  const [currentHeaderDescription, setCurrentHeaderDescription] = useState<string>(
    ruleHeaderKeyToDescription(rule),
  );
  const [, setLocalStorageActiveTab] = useLocalStorageState('rule-active-tab', rule);
  const i18n = useI18n();

  useEffect(() => {
    setLocalStorageActiveTab(rule);
  }, [setLocalStorageActiveTab, rule]);

  return (
    <PageWrapper
      title={i18n(currentHeaderId as unknown as any)}
      description={currentHeaderDescription}
      actionButton={{
        url: '/rules/request-new',
        title: 'Request New Rule',
      }}
    >
      <PageTabs
        activeKey={rule}
        onChange={(key) => {
          navigate(`/rules/${key}`, { replace: true });
          setCurrentHeaderId(`menu.rules.${key}`);
          setCurrentHeaderDescription(ruleHeaderKeyToDescription(key));
        }}
      >
        <Tabs.TabPane tab="My Rules" key="my-rules">
          <MyRule />
        </Tabs.TabPane>
        <Tabs.TabPane tab="Library" key="rules-library">
          <StepForm />
        </Tabs.TabPane>{' '}
      </PageTabs>
    </PageWrapper>
  );
};

export default TableList;
