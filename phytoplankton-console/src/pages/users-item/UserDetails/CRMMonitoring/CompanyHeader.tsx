import { useMemo } from 'react';
import { getModelName } from '../utils';
import s from './index.module.less';
import SalesForceIcon from '@/components/ui/icons/Remix/logos/salesforce.react.svg';
import ExternalLinkIcon from '@/components/ui/icons/external-link-icon.react.svg';
import FreshdeskIcon from '@/components/ui/icons/Remix/logos/freshdesk.react.svg';
import ZendeskIcon from '@/components/ui/icons/Remix/logos/zendesk.react.svg';
import { CrmModelType } from '@/apis/models/CrmModelType';

interface Props {
  link: string;
  model?: CrmModelType;
}

const CompanyHeader = (props: Props) => {
  const { link, model } = props;

  const modelName = useMemo(() => getModelName(model), [model]);

  return (
    <div className={s.header}>
      <a href={link} target="_blank">
        View in {modelName} <ExternalLinkIcon className={s.icon} />{' '}
      </a>
      {model == 'SalesforceTicket' && <SalesForceIcon className={s.logo} />}
      {model == 'FreshDeskTicket' && <FreshdeskIcon className={s.logo} />}
      {model == 'ZendeskTicket' && <ZendeskIcon className={s.logo} />}
    </div>
  );
};

export default CompanyHeader;
