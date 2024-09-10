import ContactDetails from '../../ContactDetails/index';
import Addresses from '../../Addresses';
import UsersInfoCard from './UsersInfoCard';
import { RegistrationDetails } from './RegistrationDetails';
import { FinancialDetails } from './FinancialDetails';
import s from './index.module.less';
import * as Card from '@/components/ui/Card';
import { InternalBusinessUser } from '@/apis';
import SurveyLineIcon from '@/components/ui/icons/Remix/document/survey-line.react.svg';
import CommunityLineIcon from '@/components/ui/icons/Remix/buildings/community-line.react.svg';
import { SavedPaymentDetails } from '@/pages/users-item/UserDetails/SavedPaymentDetails';

interface Props {
  user: InternalBusinessUser;
}

export default function UserDetails(props: Props) {
  const { user } = props;
  return (
    <Card.Row className={s.container}>
      <Card.Column>
        <Card.Row>
          <Card.Column>
            <Card.Section>
              <UsersInfoCard user={user} />
            </Card.Section>
          </Card.Column>
        </Card.Row>
        <Card.Row>
          <Card.Column className={s.details}>
            <Card.Subtitle
              className={s.border}
              title="Registration details"
              icon={<SurveyLineIcon />}
            />
            <RegistrationDetails user={user} />
          </Card.Column>
          <Card.Column className={s.details}>
            <Card.Subtitle
              className={s.border}
              title="Financial details"
              icon={<SurveyLineIcon />}
            />
            <FinancialDetails user={user} />
          </Card.Column>
        </Card.Row>
      </Card.Column>
      <Card.Column>
        <Card.Row>
          <Card.Column>
            <Card.Subtitle className={s.border} title="Contact details" icon={<SurveyLineIcon />} />
            <ContactDetails user={user} />
          </Card.Column>
          <Card.Column className={s.address}>
            <Card.Subtitle className={s.border} title="Addresses" icon={<CommunityLineIcon />} />
            <Addresses user={user} />
          </Card.Column>
        </Card.Row>
        <Card.Column>
          <Card.Subtitle className={s.border} title="Saved payment details" />
          <SavedPaymentDetails user={user} />
        </Card.Column>
      </Card.Column>
    </Card.Row>
  );
}
