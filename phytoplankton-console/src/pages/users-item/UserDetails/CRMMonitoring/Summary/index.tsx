import Highlights from './Highlights';
import Overview from './Overview';
import s from './index.module.less';
import { CrmSummary } from '@/apis';

interface Props {
  summary: CrmSummary;
}

const Summary = (props: Props) => {
  const { summary } = props;
  return (
    <div className={s.summary}>
      <Overview summary={summary.summary} sentiment={summary.sentiment} />
      <Highlights summary={summary} />
    </div>
  );
};

export default Summary;
