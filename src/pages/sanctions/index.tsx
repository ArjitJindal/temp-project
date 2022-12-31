import { useNavigate, useParams } from 'react-router';
import { Tabs } from 'antd';
import { SanctionsSearchTable } from './search';
import { SanctionsSearchHistoryTable } from './search-history';
import PageWrapper from '@/components/PageWrapper';
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
          <SanctionsSearchTable searchId={searchId} />
        </Tabs.TabPane>
        <Tabs.TabPane tab="Search History" key="search-history">
          <SanctionsSearchHistoryTable />
        </Tabs.TabPane>
      </PageTabs>
    </PageWrapper>
  );
};

export default SanctionsPage;
