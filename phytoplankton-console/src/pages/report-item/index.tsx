import { useParams } from 'react-router';
import { useSearchParams } from 'react-router-dom';
import Header from './components/Header';
import PageWrapper from '@/components/PageWrapper';
import { Authorized } from '@/components/utils/Authorized';
import { useReportDetails } from '@/utils/api/sar';
import AsyncResourceRenderer from '@/components/utils/AsyncResourceRenderer';
import SarReport from '@/components/Sar/SarReport';

const ReportItemPage = () => {
  const { reportId, mode } = useParams<'reportId' | 'mode'>() as {
    reportId: string;
    mode: 'edit' | 'view';
  };
  const [searchParams] = useSearchParams();
  const source = searchParams.get('source');
  const reportItemQueryResult = useReportDetails(reportId);
  return (
    <PageWrapper header={<Header source={source} />}>
      <AsyncResourceRenderer resource={reportItemQueryResult.data}>
        {(report) => <SarReport initialReport={report} mode={mode} source={source ?? ''} />}
      </AsyncResourceRenderer>
    </PageWrapper>
  );
};

const ReportItemPageWrapper = () => {
  return (
    <Authorized minRequiredResources={['read:::reports/generated/*']}>
      <ReportItemPage />
    </Authorized>
  );
};

export default ReportItemPageWrapper;
