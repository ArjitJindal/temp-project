import { firstLetterUpper } from '@flagright/lib/utils/humanize';
import { useParams } from 'react-router';
import { notEmpty } from '@/utils/array';
import Breadcrumbs from '@/components/library/Breadcrumbs';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
import { useReportDetails } from '@/utils/api/sar';
import { getOr } from '@/utils/asyncResource';
import { getUserLink } from '@/utils/api/users';
import { getCaseUrl } from '@/utils/routing';

interface IProps {
  source: string | null;
}
const Header = ({ source }: IProps) => {
  const settings = useSettings();
  const { reportId, mode } = useParams<'reportId' | 'mode'>() as {
    reportId: string;
    mode: 'edit' | 'view';
  };
  const reportItemQueryResult = useReportDetails(reportId);
  const report = getOr(reportItemQueryResult.data, null);

  return (
    <Breadcrumbs
      items={[
        ...(source === 'user'
          ? [
              {
                title: firstLetterUpper(settings.userAlias),
                to: '/users/list/all',
              },
              {
                title: report?.caseUserId ?? '',
                to: getUserLink(report?.caseUser),
              },
            ]
          : []),
        ...(source === 'alert'
          ? [
              {
                title: 'Alerts',
                to: '/case-management/cases?showCases=ALL_ALERTS',
              },
            ]
          : []),
        ...(source === 'case'
          ? [
              {
                title: 'Cases',
                to: '/case-management/cases?showCases=ALL',
              },
              {
                title: report?.caseId ?? '',
                to: getCaseUrl(report?.caseId ?? ''),
              },
            ]
          : []),
        ...(source === 'sar'
          ? [
              {
                title: 'SAR filing',
                to: '/reports',
              },
              {
                title: report?.id ?? '',
              },
            ]
          : []),
        {
          title: mode === 'edit' ? `${source === 'sar' ? 'Edit' : 'Create'} SAR` : 'View SAR',
        },
      ].filter(notEmpty)}
    />
  );
};

export default Header;
