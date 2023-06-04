import Highlights from './Highlights';
import Overview from './Overview';
import s from './index.module.less';
import { SalesforceAccountResponseAccountSummary } from '@/apis';

interface Props {
  summary: SalesforceAccountResponseAccountSummary;
}

const Summary = (props: Props) => {
  const { summary } = props;
  return (
    <div className={s.summary}>
      <Overview />
      <Highlights summary={summary} />
    </div>
  );
};

export default Summary;
