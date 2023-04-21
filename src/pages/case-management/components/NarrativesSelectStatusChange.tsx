import s from './index.module.less';
import NarrativeTemplateSelect from '@/components/NarrativeTemplateSelect';

interface Props {
  templateValue: string | undefined;
  setTemplateValue: React.Dispatch<React.SetStateAction<string | undefined>>;
}

const NarrativesSelectStatusChange = (props: Props) => {
  const { templateValue, setTemplateValue } = props;

  return (
    <div className={s.narrativeTemplateSelectContainer}>
      <NarrativeTemplateSelect templateValue={templateValue} setTemplateValue={setTemplateValue} />
    </div>
  );
};

export default NarrativesSelectStatusChange;
