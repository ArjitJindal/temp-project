import s from './index.module.less';
import Tooltip from '@/components/library/Tooltip';

type Props = {
  summary: string;
  sentiment: number;
};
const Overview = (props: Props) => {
  return (
    <div className={s.overview}>
      <div className={s.header}>
        <span>Overview</span>
      </div>
      <p>{props.summary}</p>
      <Tooltip
        title={
          'Sentiment score is determined using AI and reflects how much attention this user requires based on their behaviour.'
        }
      >
        <span>Sentiment Score - {props.sentiment}%</span>
      </Tooltip>
    </div>
  );
};

export default Overview;
