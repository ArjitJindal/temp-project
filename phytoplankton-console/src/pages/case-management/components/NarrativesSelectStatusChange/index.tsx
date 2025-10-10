import React from 'react';
import s from './index.module.less';
import NarrativeTemplateSelect from '@/components/NarrativeTemplateSelect';

interface Props {
  templateValue: string | undefined | null;
  setTemplateValue: (value: string | undefined) => void;
}

const NarrativesSelectStatusChange = (props: Props) => {
  const { templateValue, setTemplateValue } = props;

  return (
    <div className={s.root}>
      <NarrativeTemplateSelect
        mode={'TEXT'}
        templateValue={templateValue}
        setTemplateValue={setTemplateValue}
      />
    </div>
  );
};

export default NarrativesSelectStatusChange;
