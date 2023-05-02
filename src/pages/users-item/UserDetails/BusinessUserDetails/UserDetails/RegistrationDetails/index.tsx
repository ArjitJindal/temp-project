import React from 'react';
import { Tag } from 'antd';
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
import { PropertyColumns } from '@/pages/users-item/UserDetails/PropertyColumns';

interface Props {
  user: InternalBusinessUser;
}

export function RegistrationDetails(prop: Props) {
  const { user } = prop;
  return (
    <Card.Section>
      <PropertyColumns>
        <>
          <Form.Layout.Label icon={<FingerprintLineIcon />} title={'Registration status'} />
          <div>{user.legalEntity.companyGeneralDetails?.userRegistrationStatus}</div>
        </>
        <>
          <Form.Layout.Label icon={<FingerprintLineIcon />} title={'Customer segment'} />
          <div>{user.legalEntity.companyGeneralDetails?.userSegment}</div>
        </>
        <>
          <Form.Layout.Label icon={<FingerprintLineIcon />} title={'Registration ID'} />
          <div>{user.legalEntity.companyRegistrationDetails?.registrationIdentifier}</div>
        </>
        <>
          <Form.Layout.Label icon={<GovernmentIcon />} title={'Tax ID'} />
          <div>{user.legalEntity.companyRegistrationDetails?.taxIdentifier}</div>
        </>
        <>
          <Form.Layout.Label icon={<RegisteredIcon />} title={'Legal entity type'} />
          <div>{user.legalEntity.companyRegistrationDetails?.legalEntityType}</div>
        </>
        <>
          <Form.Layout.Label icon={<CalendarIcon />} title={'Registration date'} />
          <div>
            {user.legalEntity.companyRegistrationDetails?.dateOfRegistration
              ? dayjs(user.legalEntity.companyRegistrationDetails?.dateOfRegistration).format(
                  DEFAULT_DATE_FORMAT,
                )
              : '-'}
          </div>
        </>
        <>
          <Form.Layout.Label icon={<EarthLineIcon />} title={'Country of registration'} />
          <div>
            {user.legalEntity.companyRegistrationDetails?.registrationCountry ? (
              <CountryDisplay
                isoCode={user.legalEntity.companyRegistrationDetails?.registrationCountry}
              />
            ) : (
              '-'
            )}
          </div>
        </>
        <>
          <Form.Layout.Label icon={<DeleteBackLineIcon />} title={'Tags'} />
          <div>
            {user.legalEntity.companyRegistrationDetails?.tags?.map(({ key, value }: ApiTag) => (
              <Tag color={'cyan'}>
                {key}: <span style={{ fontWeight: 700 }}>{value}</span>
              </Tag>
            ))}
          </div>
        </>
      </PropertyColumns>
    </Card.Section>
  );
}
