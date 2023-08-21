import LogItem from '../LogItem';
import { useGetLogData } from '../helpers';
import s from './index.module.less';
import { useUsers } from '@/utils/user-utils';
import { AuditLog } from '@/apis';

interface Props {
  date: string;
  logs: AuditLog[];
  type: 'USER' | 'CASE';
}

const LogContainer = (props: Props) => {
  const { date, logs, type } = props;
  const [users, _] = useUsers();
  const logItems = useGetLogData(logs, users, type);
  return logItems && logItems.length ? (
    <div className={s.root}>
      <div className={s.date}>{date}</div>
      <div className={s.logItems}>
        {logItems.map((logItem) => (
          <LogItem logItem={logItem} />
        ))}
      </div>
    </div>
  ) : (
    <></>
  );
};

export default LogContainer;
