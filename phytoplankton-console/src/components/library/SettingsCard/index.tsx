import { Resource } from '@flagright/lib/utils';
import s from './style.module.less';
import InformationLineIcon from '@/components/ui/icons/Remix/system/information-line.react.svg';
import Tooltip from '@/components/library/Tooltip';
import * as Card from '@/components/ui/Card';
import { H4, P } from '@/components/ui/Typography';
import { Authorized } from '@/components/utils/Authorized';

interface Props {
  title: string;
  description?: string;
  info?: string;
  children?: React.ReactNode;
  minRequiredResources?: Resource[];
}

export default function SettingsCard(props: Props) {
  const { title, description, children, info, minRequiredResources } = props;
  return (
    <Authorized minRequiredResources={minRequiredResources ?? []}>
      <Card.Root noBorder className={s.root}>
        <section className={s.headingContainer}>
          <H4 className={s.heading}>{title}</H4>
          {info && info.length > 0 && (
            <Tooltip title={info}>
              <InformationLineIcon className={s.tooltipIcon} />
            </Tooltip>
          )}
        </section>
        {description && <P className={s.paragraph}>{description}</P>}
        {children}
      </Card.Root>
    </Authorized>
  );
}
