import { useNavigate, useParams } from 'react-router';
import { Tabs } from 'antd';
import { SanctionsSearchTable } from './search';
import { SanctionsSearchHistoryTable } from './search-history';
import PageWrapper from '@/components/PageWrapper';

const SanctionsPage: React.FC = () => {
  const { type = 'search' } = useParams<'type'>();
  const { searchId } = useParams<'searchId'>();
  const navigate = useNavigate();
  return (
    <PageWrapper>
      <Tabs
        type="line"
        activeKey={type}
        destroyInactiveTabPane={true}
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
      </Tabs>
    </PageWrapper>
  );
};

export default SanctionsPage;
