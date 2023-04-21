import { TableAlertItem } from '../types';
import TransactionsAndComments from './TransactionsAndComments';
import ScreeningMatchList from './ScreeningMatchList';

interface Props {
  alert: TableAlertItem;
}

export default function ExpandedRowRenderer(props: Props) {
  const { alert } = props;

  if (alert.ruleNature === 'SCREENING') {
    return <ScreeningMatchList alert={alert} />;
  }

  return <TransactionsAndComments alert={alert} />;
}
