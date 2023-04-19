import TransactionsAndComments from './TransactionsAndComments';
import ScreeningMatchList from './ScreeningMatchList';
import { Alert } from '@/apis';

interface Props {
  alert: Alert;
}

export default function ExpandedRowRenderer(props: Props) {
  const { alert } = props;

  if (alert.ruleNature === 'SCREENING') {
    return <ScreeningMatchList alert={alert} />;
  }

  return <TransactionsAndComments alert={alert} />;
}
