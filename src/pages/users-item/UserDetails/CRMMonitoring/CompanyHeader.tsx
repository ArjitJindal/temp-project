import s from './index.module.less';
import SalesForceIcon from '@/components/ui/icons/Remix/logos/salesforce.react.svg';
import ExternalLinkIcon from '@/components/ui/icons/external-link-icon.react.svg';

interface Props {
  link: string;
}

const CompanyHeader = (props: Props) => {
  const { link } = props;
  return (
    <div className={s.header}>
      <a href={link} target="_blank">
        View in Salesforce <ExternalLinkIcon className={s.icon} />{' '}
      </a>
      <SalesForceIcon className={s.logo} />
    </div>
  );
};

export default CompanyHeader;
