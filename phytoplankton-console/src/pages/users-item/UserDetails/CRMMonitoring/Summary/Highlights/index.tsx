import s from './index.module.less';
import Alert from '@/components/library/Alert';
import { SalesforceAccountResponseAccountSummary } from '@/apis';

interface Props {
  summary: SalesforceAccountResponseAccountSummary;
}

const Highlights = (props: Props) => {
  const { summary } = props;
  return (
    <div className={s.highlights}>
      <h3>Highlights</h3>
      {summary.good && <Alert type={'success'}>{summary.good}</Alert>}
      {summary.neutral && <Alert type={'info'}>{summary.neutral}</Alert>}
      {summary.bad && <Alert type={'warning'}>{summary.bad}</Alert>}
    </div>
  );
};

export default Highlights;
