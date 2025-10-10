import LogItem, { LogItemData } from './LogItem';
import s from './index.module.less';

interface Props {
  date: string;
  logs: LogItemData[];
}

export default function LogContainer(props: Props) {
  const { date, logs: logItems } = props;
  return logItems && logItems.length ? (
    <div className={s.root}>
      <div className={s.date}>{date}</div>
      <div className={s.logItems}>
        {logItems.map((logItem, index) => (
          <LogItem key={index} logItem={logItem} />
        ))}
      </div>
    </div>
  ) : (
    <></>
  );
}
