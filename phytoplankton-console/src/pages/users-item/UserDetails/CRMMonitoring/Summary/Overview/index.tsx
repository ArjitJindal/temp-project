import s from './index.module.less';

type Props = {
  summary: string;
  sentiment: number;
};
const Overview = (props: Props) => {
  return (
    <div className={s.overview}>
      <div className={s.header}>
        <span>Overview</span>
        {/* <CompanyHeader /> */}
      </div>
      <p>{props.summary}</p>
      <span>Sentiment Score - {props.sentiment}</span>
    </div>
  );
};

export default Overview;
