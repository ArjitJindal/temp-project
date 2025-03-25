import s from './index.module.less';
import Tooltip from '@/components/library/Tooltip';
import { useSettings } from '@/components/AppWrapper/Providers/SettingsProvider';
type Props = {
  summary: string;
  sentiment: number;
};
const Overview = (props: Props) => {
  const settings = useSettings();
  return (
    <div className={s.overview}>
      <div className={s.header}>
        <span>Overview</span>
      </div>
      <p>{props.summary}</p>
      <Tooltip
        title={`Sentiment score is determined using AI and reflects how much attention this ${settings.userAlias} requires based on their behaviour.`}
      >
        <span>Sentiment score - {props.sentiment}%</span>
      </Tooltip>
    </div>
  );
};

export default Overview;
