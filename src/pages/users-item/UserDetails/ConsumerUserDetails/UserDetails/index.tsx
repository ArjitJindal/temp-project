import ContactDetails from '../../ContactDetails/index';
import Addresses from '../../Addresses';
import UsersInfoCard from './UsersInfoCard';
import s from './index.module.less';
import * as Card from '@/components/ui/Card';
import { InternalConsumerUser } from '@/apis';
import SurveyLineIcon from '@/components/ui/icons/Remix/document/survey-line.react.svg';
import CommunityLineIcon from '@/components/ui/icons/Remix/buildings/community-line.react.svg';

interface Props {
  user: InternalConsumerUser;
  collapsedByDefault?: boolean;
}

export default function UserDetails(props: Props) {
  const { user } = props;
  return (
    <Card.Root
      header={{
        title: 'User Details',
      }}
    >
      <Card.Row>
        <Card.Column className={s.all}>
          <Card.Section className={s.section}>
            <UsersInfoCard user={user} />
          </Card.Section>
        </Card.Column>
        <Card.Column className={s.contact}>
          <Card.Subtitle className={s.border} title="Contact Details" icon={<SurveyLineIcon />} />
          <ContactDetails user={user as InternalConsumerUser} />
        </Card.Column>
        <Card.Column className={s.address}>
          <Card.Subtitle className={s.border} title="Addresses" icon={<CommunityLineIcon />} />
          <Addresses user={user as InternalConsumerUser} />
        </Card.Column>
      </Card.Row>
    </Card.Root>
  );
}
