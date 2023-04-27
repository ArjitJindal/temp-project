import React from 'react';
import s from './index.module.less';
import * as Card from '@/components/ui/Card';
import { InternalBusinessUser, InternalConsumerUser } from '@/apis';
import Calender2LineIcon from '@/components/ui/icons/Remix/business/calendar-2-line.react.svg';
import User3LineIcon from '@/components/ui/icons/Remix/user/user-3-line.react.svg';
import EarthLineIcon from '@/components/ui/icons/Remix/map/earth-line.react.svg';
import Home4LineIcon from '@/components/ui/icons/Remix/buildings/home-4-line.react.svg';
import * as Form from '@/components/ui/Form';
import { callRender } from '@/components/library/Table/dataTypeHelpers';
import { EMAIL, EXTERNAL_LINK, FAX, PHONE } from '@/components/library/Table/standardDataTypes';

interface Props {
  user: InternalConsumerUser | InternalBusinessUser;
}

export default function ContactDetails(props: Props) {
  const { user } = props;
  return (
    <Card.Section>
      <div className={s.details}>
        <Card.Row className={s.items}>
          <Card.Column className={s.col}>
            <Form.Layout.Label icon={<Calender2LineIcon />} title={'Email'} />
          </Card.Column>
          <Card.Column className={s.all}>
            {user.type === 'CONSUMER'
              ? user.contactDetails?.emailIds?.map((x) => callRender(EMAIL, x))
              : user.legalEntity.contactDetails?.emailIds?.map((x) => callRender(EMAIL, x))}
          </Card.Column>
        </Card.Row>
        <Card.Row className={s.items}>
          <Card.Column className={s.col}>
            <Form.Layout.Label icon={<User3LineIcon />} title={'Tel.'} />
          </Card.Column>
          <Card.Column className={s.all}>
            {user.type === 'CONSUMER'
              ? user.contactDetails?.contactNumbers?.map((x) => callRender(PHONE, x))
              : user.legalEntity.contactDetails?.contactNumbers?.map((x) => callRender(PHONE, x))}
          </Card.Column>
        </Card.Row>
        <Card.Row className={s.items}>
          <Card.Column className={s.col}>
            <Form.Layout.Label icon={<EarthLineIcon />} title={'Fax'} />
          </Card.Column>
          <Card.Column className={s.all}>
            {user.type === 'CONSUMER'
              ? user.contactDetails?.faxNumbers?.map((x) => callRender(FAX, x))
              : user.legalEntity.contactDetails?.faxNumbers?.map((x) => callRender(FAX, x))}
          </Card.Column>
        </Card.Row>
        <Card.Row className={s.items}>
          <Card.Column className={s.col}>
            <Form.Layout.Label icon={<Home4LineIcon />} title={'Website'} />
          </Card.Column>
          <Card.Column className={s.all}>
            {user.type === 'CONSUMER'
              ? user.contactDetails?.websites?.map((x) => callRender(EXTERNAL_LINK, x))
              : user.legalEntity.contactDetails?.websites?.map((x) => callRender(EXTERNAL_LINK, x))}
          </Card.Column>
        </Card.Row>
      </div>
    </Card.Section>
  );
}
