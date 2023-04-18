import { useNavigate, useParams } from 'react-router';
import { Tabs } from 'antd';
import { SanctionsSearchTable } from './search';
import { SanctionsSearchHistoryTable } from './search-history';
import PageWrapper, { PageWrapperTableContainer } from '@/components/PageWrapper';
import PageTabs from '@/components/ui/PageTabs';
import { usePageViewTracker } from '@/utils/tracker';

const SanctionsPage: React.FC = () => {
  usePageViewTracker('Sanctions Page');
  const { type = 'search' } = useParams<'type'>();
  const { searchId } = useParams<'searchId'>();
  const navigate = useNavigate();
  return (
    <PageWrapper>
      <PageTabs
        activeKey={type}
        onChange={(key) => {
          navigate(`/sanctions/${key}`, { replace: true });
        }}
      >
        <Tabs.TabPane tab="Search" key="search">
          <PageWrapperTableContainer>
            <SanctionsSearchTable searchId={searchId} />
          </PageWrapperTableContainer>
        </Tabs.TabPane>
        <Tabs.TabPane tab="Search History" key="search-history">
          <PageWrapperTableContainer>
            <SanctionsSearchHistoryTable />
          </PageWrapperTableContainer>
        </Tabs.TabPane>
      </PageTabs>
    </PageWrapper>
  );
};

export default SanctionsPage;
