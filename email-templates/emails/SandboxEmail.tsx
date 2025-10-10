import {
  Column,
  Heading,
  Html,
  Img,
  Section,
  Text,
  Row,
  Link,
} from '@react-email/components'
import * as React from 'react'
import { Card } from '../components/CustomCard'
import CustomButton from '../components/CustomButton'
import MailHead from '../components/MailHead'
import MailContainer from '../components/MailContainer'

export function SandboxEmail() {
  return (
    <Html>
      <MailHead />
      <MailContainer>
        <WelcomeHeading />
        <TeamManagementCard />
        <Card
          title="
          View API key"
          logo="https://lh3.googleusercontent.com/pw/ABLVV86XOUgjBsf9fWku-vUF5Uty49v3nDKeIPEOLGDGLBjKjd7xgG1bbTizIZllzqjRJWkZNiUVjLkn7qN61C6VvN-700bVk5o5X_miLjyhBdhIkYy-GeiSmPuYcnQXyKaO7Db_fDbiWZQpdNpouJpOjXOK=w64-h65-s-no-gm?authuser=0"
          image="https://lh3.googleusercontent.com/pw/ABLVV85E1G0HGNA6c8oeCilQaO6KzOEqrh58sEWhH1C025OKYOCIvTwEkamcSVWk9PkPew24fVgb-vKx4GtqQY-3UUZXW71buZ0kuHlCJLdfPfUHe3jNHZYZcba9KBs0W08YdB5uKi5aIiyv_ENEyHgE7h8O=w468-h275-s-no-gm?authuser=0"
          imageLink="https://sandbox.support.flagright.com/share/475b99f9-9692-45f2-a8ed-8c1e3065f874"
          textLink="https://sandbox.console.flagright.com/settings/developers"
          description="
          Retrieve API key from developers settings."
        />
        <Card
          title="
          Customer support"
          logo="https://lh3.googleusercontent.com/pw/ABLVV85NlUsMiZXeZRU4RgxFwWI1wiQvUSRz3LK1oKr5QNzWqAsjAAnM0_GhDssAJk8c0y6sR3DyhFgNX340meAPJ4iQonmo_R_Xu_qM9xtaBB5EuzOLuPRd8SzNfF3EPfgFsSS2sjClbbZ2VJJSF_F4nig9=w64-h65-s-no-gm?authuser=0"
          image="https://lh3.googleusercontent.com/pw/ABLVV85S3He_sr100XH0pEzixVHtbyOYn18Z7adJHUC07Y_bBRmhfWLRPK-tQKMP8dUqq2VuO3-JZieZ9tPPLFywKx1qsKoY_e-A2d6k036c2Hwd_LbBUFB-cSZt4kyJoJZgJ6Pu7ZkZIO39egasWTWIEIlP=w468-h275-s-no-gm?authuser=0"
          imageLink="https://sandbox.support.flagright.com/share/d07217e0-17aa-456a-afa3-bcf767f72bab"
          textLink="https://www.support.flagright.com/tickets"
          description="If you run into any issues or have questions, Flagright support team is here to assist you."
        />
        <Row>
          <Column style={{ paddingRight: '12px' }}>
            <Card
              title="API documentation"
              logo="https://lh3.googleusercontent.com/pw/ABLVV840wufprQ-b2uwGh_mP8t4juAVhROZEVkX4zwfMqr9uoKsLo23Q-wdWLzHzybH6AuC7wjeC3w2IVslaMsS8WSOChoXxzgSB7kZHF9qcFMU8xwEwpldlXt5E1FWrXN6ICBg9XI9HeIOGyiuDilMrh7cj=w64-h65-s-no-gm?authuser=0"
              textLink="https://docs.flagright.com/"
              description="Explore our API documentation."
            />
          </Column>
          <Column style={{ paddingLeft: '12px' }}>
            <Card
              title="Meet our customers"
              logo="https://lh3.googleusercontent.com/pw/ABLVV87njPWUtIZk-C-5X-T691k8sqfuxpD30fgzoofQaTiyodysSffKhgNrH4mnqcjg37N4Bl_cZNRe6j-RRKcRVHSHFFyUODQIkit33nnLpA2r2itpgyB3oHdQV10JEdt7JEsXmHTGmagWt_DNaZkmyrAs=w64-h65-s-no-gm?authuser=0"
              textLink="https://www.flagright.com/customers"
              description="Explore our customers' success stories."
            />
          </Column>
        </Row>
        <Row>
          <Column>
            <Card
              title="Follow us on LinkedIn"
              logo="https://lh3.googleusercontent.com/pw/ABLVV86XPC6gurvUqrs6Cb4gtf8cHxnVulm7xdduE23nZ3u_DQvlREG1llpYwV5e98-bYkGcwFUA-ZibPBPZo5HN-0NaviZR_ML6DY3MqVVl-w7jvdita5mw3prtW5B5E4aqV4TKp8TjOnoj2FzL9OSMrVK6=w64-h65-s-no-gm?authuser=0"
              textLink="https://in.linkedin.com/company/flagright"
              description="Follow us on LinkedIn and stay up to date with latest FinCrime news."
            />
          </Column>
        </Row>
        <Section>
          <FooterContent />
          <CustomButton
            url="https://sandbox.console.flagright.com/"
            text="Open Flagright console"
          />
        </Section>
      </MailContainer>
    </Html>
  )
}

export function TeamManagementCard() {
  return (
    <Card
      title="
                    Add your team to Flagright"
      logo="https://lh3.googleusercontent.com/pw/ABLVV84jn_0smcxYsGTzWu55W9EgKHk5huQsH_bxLhixRzq6iF3SsyXizF1wimTTg66tLLGHVz8CHwe7R0VlPavWugIVDEEDcPNbRpbxT9XZcVSBd0YLW3L5RT8vFADRlPQZ6Wd42zu_fwyLZdRbkBIGgIXY=w64-h65-s-no-gm?authuser=0"
      image="https://lh3.googleusercontent.com/pw/ABLVV86h6hX0gHtS1dhy2gng44qSGinBc74uGS3_HAlHAR0JTRRvwg1ftt4YBuUxPJ78fUvCLLCMrpj0gPFYgGnmUavKcHM1KB5ox1LDn9sqTViJWfKNzpG3dDd7LUuQ5rGuT-ZnaREwo5Cj8kf0htH-sARd=w468-h275-s-no-gm?authuser=0"
      imageLink="https://sandbox.support.flagright.com/share/1d46ef45-0490-4da9-960c-b596f0dc1f27"
      textLink="
          https://sandbox.console.flagright.com/accounts/team"
      description="
                    Easily bring team members on board and manage roles."
    />
  )
}

export function FooterContent() {
  return (
    <>
      <Text style={{ fontWeight: 400 }}>
        Thanks for signing up. We’re here to help you and your team. If you have
        any questions, contact us at{' '}
        <Link href="mailto:support@flagright.com" style={{ color: '#1169F9' }}>
          support@flagright.com
        </Link>
        .
      </Text>
    </>
  )
}

export function WelcomeHeading() {
  return (
    <>
      <Img
        src="https://lh6.googleusercontent.com/tocqbH_zqQ_iBpNofXXCz_3OkzXjhiTELkjUwr6JkZe-9uDy346lRr5oE28W5uARzRE=w2400"
        width={'150'}
      />
      <Heading
        style={{
          fontFamily: 'Noto Sans',
          fontSize: '24px',
          fontStyle: 'normal',
          fontWeight: '600',
          lineHeight: 'normal',
        }}
      >
        Welcome to Flagright
      </Heading>
      <Text>
        At Flagright we believe software can feel magical. Well designed tools
        and practices encourage momentum and level up execution in our teams.
      </Text>
      <Text>
        We’re excited to welcome you to Flagright. And we’re committed to
        pushing our own limits so that we can help you reach yours.{' '}
      </Text>
      <Text>
        Below, you’ll find our most useful links and short video instructions to
        help you get started - please note that you must join the console first
        to view them.
      </Text>
    </>
  )
}

export default SandboxEmail
