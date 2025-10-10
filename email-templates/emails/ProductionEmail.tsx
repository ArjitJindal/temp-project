import { Column, Html, Section, Row } from '@react-email/components'
import * as React from 'react'
import { Card } from '../components/CustomCard'
import CustomButton from '../components/CustomButton'
import {
  FooterContent,
  TeamManagementCard,
  WelcomeHeading,
} from './SandboxEmail'
import MailHead from '../components/MailHead'
import MailContainer from '../components/MailContainer'

export function ProductionEmail() {
  return (
    <Html>
      <MailHead />
      <MailContainer>
        <WelcomeHeading />
        <TeamManagementCard />
        <Row>
          <Column style={{ paddingRight: '12px' }}>
            <Card
              title="Customer support"
              logo="https://lh3.googleusercontent.com/pw/ABLVV85NlUsMiZXeZRU4RgxFwWI1wiQvUSRz3LK1oKr5QNzWqAsjAAnM0_GhDssAJk8c0y6sR3DyhFgNX340meAPJ4iQonmo_R_Xu_qM9xtaBB5EuzOLuPRd8SzNfF3EPfgFsSS2sjClbbZ2VJJSF_F4nig9=w64-h65-s-no-gm?authuser=0"
              textLink="https://www.support.flagright.com/tickets"
              description="If you run into any issues or have questions, Flagright support team is here to assist you."
              halfCard
            />
          </Column>
          <Column style={{ paddingLeft: '12px' }}>
            <Card
              title="Knowledge center"
              logo="https://lh3.googleusercontent.com/pw/ABLVV858W4duNqkrF8jHYA0u5qkKw3JRZ4n5E9c3Firp09Ty5PKxx_stD1rHyDqP_NrMpsqtLzrOccQKey4SeFavAWJzi8c4n2wI8lrRdbv1lefguo73XggSuOcpVMWvLo_44HSjiHAo0N3A8fVPXOWKXk44=w64-h65-s-no-gm?authuser=0"
              textLink="https://www.support.flagright.com/knowledge"
              description="Explore our how-to guides."
              halfCard
            />
          </Column>
        </Row>
        <Row>
          <Column style={{ paddingRight: '12px' }}>
            <Card
              title="Meet our customers"
              logo="https://lh3.googleusercontent.com/pw/ABLVV87njPWUtIZk-C-5X-T691k8sqfuxpD30fgzoofQaTiyodysSffKhgNrH4mnqcjg37N4Bl_cZNRe6j-RRKcRVHSHFFyUODQIkit33nnLpA2r2itpgyB3oHdQV10JEdt7JEsXmHTGmagWt_DNaZkmyrAs=w64-h65-s-no-gm?authuser=0"
              textLink="https://www.flagright.com/customers"
              description="Explore our customers' success stories."
              halfCard
            />
          </Column>
          <Column style={{ paddingLeft: '12px' }}>
            <Card
              title="Follow us on LinkedIn"
              logo="https://lh3.googleusercontent.com/pw/ABLVV86XPC6gurvUqrs6Cb4gtf8cHxnVulm7xdduE23nZ3u_DQvlREG1llpYwV5e98-bYkGcwFUA-ZibPBPZo5HN-0NaviZR_ML6DY3MqVVl-w7jvdita5mw3prtW5B5E4aqV4TKp8TjOnoj2FzL9OSMrVK6=w64-h65-s-no-gm?authuser=0"
              textLink="https://in.linkedin.com/company/flagright"
              halfCard
              description="Follow us on LinkedIn and stay up to date with latest FinCrime news."
            />
          </Column>
        </Row>
        <Section>
          <FooterContent />
          <CustomButton
            text="Open Flagright console"
            url="https://console.flagright.com"
          />
        </Section>
      </MailContainer>
    </Html>
  )
}

export default ProductionEmail
