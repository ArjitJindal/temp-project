import { startCase } from 'lodash';
import s from './index.module.less';
import ExternalLinkIcon from '@/components/ui/icons/external-link-icon.react.svg';
import FreshdeskIcon from '@/components/ui/icons/Remix/logos/freshdesk.react.svg';
import { CrmName } from '@/apis';

interface Props {
  link: string;
  crmName: CrmName;
}

const CompanyHeader = (props: Props) => {
  const { link, crmName } = props;

  return (
    <div className={s.header}>
      <a href={link} target="_blank">
        View in {startCase(crmName.toLowerCase())} <ExternalLinkIcon className={s.icon} />{' '}
      </a>
      {crmName == 'FRESHDESK' && <FreshdeskIcon className={s.logo} />}
    </div>
  );
};

export default CompanyHeader;
