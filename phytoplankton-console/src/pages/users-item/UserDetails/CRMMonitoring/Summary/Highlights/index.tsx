import s from './index.module.less';
import Alert from '@/components/library/Alert';
import { CrmSummary } from '@/apis';

interface Props {
  summary: CrmSummary;
}

const Highlights = (props: Props) => {
  const { summary } = props;
  return (
    <div className={s.highlights}>
      <h3>Highlights</h3>
      {summary.bad && <Alert type={'warning'}>{summary.bad}</Alert>}
      {summary.good && <Alert type={'success'}>{summary.good}</Alert>}
      {summary.neutral && <Alert type={'info'}>{summary.neutral}</Alert>}
    </div>
  );
};

export default Highlights;
