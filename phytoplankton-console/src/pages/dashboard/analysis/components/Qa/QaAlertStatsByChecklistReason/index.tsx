import { ChecklistChart } from './ChecklistChart';
import { useChecklistTemplates } from '@/hooks/api/checklists';
import { WidgetProps } from '@/components/library/Widget/types';
import WidgetBase from '@/components/library/Widget/WidgetBase';

interface Props extends WidgetProps {}

const QaAlertStatsByChecklistReason = (props: Props) => {
  const queryResult = useChecklistTemplates();

  return (
    <WidgetBase width="FULL" id={`${props.id}-full-widget`}>
      <ChecklistChart {...props} data={queryResult.data} />
    </WidgetBase>
  );
};

export default QaAlertStatsByChecklistReason;
