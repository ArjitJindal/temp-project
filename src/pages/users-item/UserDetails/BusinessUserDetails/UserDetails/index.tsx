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
              title="Registration Details"
              icon={<SurveyLineIcon />}
            />
            <RegistrationDetails user={user} />
          </Card.Column>
          <Card.Column className={s.details}>
            <Card.Subtitle
              className={s.border}
              title="Financial Details"
              icon={<SurveyLineIcon />}
            />
            <FinancialDetails user={user} />
          </Card.Column>
        </Card.Row>
      </Card.Column>
      <Card.Column className={s.details}>
        <Card.Subtitle className={s.border} title="Contact Details" icon={<SurveyLineIcon />} />
        <ContactDetails user={user as InternalBusinessUser} />
      </Card.Column>
      <Card.Column className={s.address}>
        <Card.Subtitle className={s.border} title="Addresses" icon={<CommunityLineIcon />} />
        <Addresses user={user as InternalBusinessUser} />
      </Card.Column>
    </Card.Row>
  );
}
