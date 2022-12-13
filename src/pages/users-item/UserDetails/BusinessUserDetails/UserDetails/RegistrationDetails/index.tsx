import React from 'react';
import { Tag } from 'antd';
import s from './index.module.less';
import { dayjs, DEFAULT_DATE_FORMAT } from '@/utils/dayjs';
import { InternalBusinessUser } from '@/apis';
import * as Card from '@/components/ui/Card';
import FingerprintLineIcon from '@/components/ui/icons/Remix/device/fingerprint-line.react.svg';
import RegisteredIcon from '@/components/ui/icons/Remix/business/registered-line.react.svg';
import CalendarIcon from '@/components/ui/icons/Remix/business/calendar-event-line.react.svg';
import GovernmentIcon from '@/components/ui/icons/Remix/buildings/government-line.react.svg';
import * as Form from '@/components/ui/Form';
import EarthLineIcon from '@/components/ui/icons/Remix/map/earth-line.react.svg';
import DeleteBackLineIcon from '@/components/ui/icons/Remix/system/delete-back-line.react.svg';
import { Tag as ApiTag } from '@/apis/models/Tag';
import CountryDisplay from '@/components/ui/CountryDisplay';

interface Props {
  user: InternalBusinessUser;
}

export function RegistrationDetails(prop: Props) {
  const { user } = prop;
  return (
    <Card.Section>
      <div className={s.details}>
        <Card.Row className={s.items}>
          <Card.Column>
            <Form.Layout.Label icon={<FingerprintLineIcon />} title={'Registration ID'} />
          </Card.Column>
          <Card.Column className={s.all}>
            {user.legalEntity.companyRegistrationDetails?.registrationIdentifier}
          </Card.Column>
        </Card.Row>
        <Card.Row className={s.items}>
          <Card.Column className={s.all}>
            {user.legalEntity.companyRegistrationDetails?.registrationCountry}
          </Card.Column>
        </Card.Row>
        <Card.Row className={s.items}>
          <Card.Column>
            <Form.Layout.Label icon={<GovernmentIcon />} title={'Tax ID'} />
          </Card.Column>
          <Card.Column className={s.all}>
            {user.legalEntity.companyRegistrationDetails?.taxIdentifier}
          </Card.Column>
        </Card.Row>
        <Card.Row className={s.items}>
          <Card.Column>
            <Form.Layout.Label icon={<RegisteredIcon />} title={'Legal Entity Type'} />
          </Card.Column>
          <Card.Column className={s.all}>
            {user.legalEntity.companyRegistrationDetails?.legalEntityType}
          </Card.Column>
        </Card.Row>
        <Card.Row className={s.items}>
          <Card.Column>
            <Form.Layout.Label icon={<CalendarIcon />} title={'Registration Date'} />
          </Card.Column>
          <Card.Column className={s.all}>
            {user.legalEntity.companyRegistrationDetails?.dateOfRegistration
              ? dayjs(user.legalEntity.companyRegistrationDetails?.dateOfRegistration).format(
                  DEFAULT_DATE_FORMAT,
                )
              : '-'}
          </Card.Column>
        </Card.Row>
        <Card.Row className={s.items}>
          <Card.Column>
            <Form.Layout.Label icon={<EarthLineIcon />} title={'Country of Registration'} />
          </Card.Column>
          <Card.Column className={s.all}>
            {user.legalEntity.companyRegistrationDetails?.registrationCountry ? (
              <CountryDisplay
                isoCode={user.legalEntity.companyRegistrationDetails?.registrationCountry}
              />
            ) : (
              '-'
            )}
          </Card.Column>
        </Card.Row>
        <Card.Row className={s.items}>
          <Card.Column>
            <Form.Layout.Label icon={<DeleteBackLineIcon />} title={'Tags'} />
          </Card.Column>
          <Card.Column className={s.all}>
            <div>
              {user.legalEntity.companyRegistrationDetails?.tags?.map(({ key, value }: ApiTag) => (
                <Tag color={'cyan'}>
                  {key}: <span style={{ fontWeight: 700 }}>{value}</span>
                </Tag>
              ))}
            </div>
          </Card.Column>
        </Card.Row>
      </div>
    </Card.Section>
  );
}
