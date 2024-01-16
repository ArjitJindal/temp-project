import { Column, Img, Link, Row, Section, Text } from '@react-email/components'

import * as React from 'react'
interface CardProps {
  textLink: string
  imageLink?: string
  image?: string
  title: string
  description: string
  logo: string
  halfCard?: boolean
}

export function Card(props: CardProps) {
  const { textLink, imageLink, image, title, description, logo, halfCard } =
    props
  return (
    <Section
      style={{
        border: '1px solid #F4F4F5',
        borderRadius: '10px',
        padding: '16px',
        marginBottom: '16px',
        display: 'flex',
        justifyContent: 'start',
        minHeight: `${halfCard ? '200px' : '179px'}`,
        width: `${halfCard ? '266px' : '100%'}`,
      }}
    >
      <Row style={{ borderCollapse: 'collapse' }}>
        <Column>
          <Img style={{ width: '32px' }} src={logo} />

          <Link href={textLink}>
            <Row
              style={{
                display: 'inline-block',
              }}
            >
              <Column style={{ padding: 0, margin: 0 }}>
                <Text
                  style={{
                    color: '#1169F9',
                    fontSize: '16px',
                    fontWeight: '700',
                    marginBottom: '4px',
                    marginRight: '2px',
                  }}
                >
                  {title}
                </Text>
              </Column>
              <Column>
                <Img
                  src="https://lh3.googleusercontent.com/pw/ABLVV84CdeFhA3fnCIocgHNcywWjgLfL12ZDrE80ZNS3gtw_x1qboG7qS_xusExEr5zmpnzICQEfuvRVdQMcD1oeifgmbTNRbFvBFcxyMoFS0NBxAC-fZHFBEY2zQpxGZdfHy0keOutF_TRhdLis7pm23iCr=w32-h33-s-no-gm?authuser=0"
                  width={'20px'}
                  style={{
                    marginTop: '13px',
                  }}
                />
              </Column>
            </Row>
          </Link>
          <Text style={{ margin: 0 }}>{description}</Text>
        </Column>
        {image && (
          <Column>
            <Link href={imageLink}>
              <Img src={image} width="234" />
            </Link>
          </Column>
        )}
      </Row>
    </Section>
  )
}
