import { ChecklistChart } from './ChecklistChart';
import { useChecklistTemplates } from '@/hooks/api/checklists';
import { WidgetProps } from '@/components/library/Widget/types';
import WidgetBase from '@/components/library/Widget/WidgetBase';
import { map } from '@/utils/asyncResource';

interface Props extends WidgetProps {}

const QaAlertStatsByChecklistReason = (props: Props) => {
  const queryResult = useChecklistTemplates() as any;

  const dataRes = map(queryResult.data, ({ data }) => data);
  return (
    <WidgetBase width="FULL" id={`${props.id}-full-widget`}>
      <ChecklistChart {...props} data={dataRes} />
    </WidgetBase>
  );
};

export default QaAlertStatsByChecklistReason;
