import ContactDetails from '../../ContactDetails/index';
import Addresses from '../../Addresses';
import { BankDetails } from '../../BusinessUserDetails/UserDetails/BankDetails';
import UsersInfoCard from './UsersInfoCard';
import s from './index.module.less';
import * as Card from '@/components/ui/Card';
import { InternalConsumerUser } from '@/apis';
import SurveyLineIcon from '@/components/ui/icons/Remix/document/survey-line.react.svg';
import CommunityLineIcon from '@/components/ui/icons/Remix/buildings/community-line.react.svg';
import { SavedPaymentDetails } from '@/pages/users-item/UserDetails/SavedPaymentDetails';

interface Props {
  user: InternalConsumerUser;
  title: string;
}

export default function UserDetails(props: Props) {
  const { user, title } = props;
  return (
    <Card.Root header={{ title }}>
      <Card.Row className={s.container}>
        <Card.Column className={s.all}>
          <Card.Section>
            <UsersInfoCard user={user} />
          </Card.Section>
        </Card.Column>
        <Card.Column>
          <Card.Row>
            <Card.Column className={s.contact}>
              <Card.Subtitle
                className={s.border}
                title="Contact details"
                icon={<SurveyLineIcon />}
              />
              <ContactDetails user={user as InternalConsumerUser} />
            </Card.Column>
            <Card.Column className={s.address}>
              <Card.Subtitle className={s.border} title="Addresses" icon={<CommunityLineIcon />} />
              <Addresses user={user as InternalConsumerUser} />
            </Card.Column>
          </Card.Row>
          <Card.Column>
            <Card.Subtitle title="Bank details" icon={<SurveyLineIcon />} />
            <BankDetails user={user} />
          </Card.Column>
          <Card.Column>
            <Card.Subtitle className={s.border} title="Saved payment details" />
            <SavedPaymentDetails user={user} />
          </Card.Column>
        </Card.Column>
      </Card.Row>
    </Card.Root>
  );
}
