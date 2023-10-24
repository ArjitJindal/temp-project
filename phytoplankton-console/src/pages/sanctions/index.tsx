import { useNavigate, useParams } from 'react-router';
import { Tabs } from 'antd';
import { SanctionsSearchTable } from './search';
import { SanctionsSearchHistoryTable } from './search-history';
import { Activity } from './Activity';
import PageWrapper, { PageWrapperContentContainer } from '@/components/PageWrapper';
import PageTabs from '@/components/ui/PageTabs';
import { useI18n } from '@/locales';

const SanctionsPage: React.FC = () => {
  const { type = 'search' } = useParams<'type'>();
  const { searchId } = useParams<'searchId'>();
  const navigate = useNavigate();
  const i18n = useI18n();
  return (
    <PageWrapper title={i18n('menu.sanctions')}>
      <PageTabs
        activeKey={type}
        onChange={(key) => {
          navigate(`/sanctions/${key}`, { replace: true });
        }}
      >
        <Tabs.TabPane tab="Search" key="search">
          <PageWrapperContentContainer>
            <SanctionsSearchTable searchId={searchId} />
          </PageWrapperContentContainer>
        </Tabs.TabPane>
        <Tabs.TabPane tab="Search history" key="search-history">
          <PageWrapperContentContainer>
            <SanctionsSearchHistoryTable />
          </PageWrapperContentContainer>
        </Tabs.TabPane>
        <Tabs.TabPane tab="Activity" key="activity">
          <PageWrapperContentContainer>
            <Activity />
          </PageWrapperContentContainer>
        </Tabs.TabPane>
      </PageTabs>
    </PageWrapper>
  );
};

export default SanctionsPage;
