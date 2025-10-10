import { Container } from '@react-email/components'
import React from 'react'

interface Props {
  children?: React.ReactNode
}
function MailContainer(props: Props) {
  return (
    <Container
      style={{
        boxSizing: 'border-box',
        minWidth: '600px',
        background: '#fff',
        padding: '24px',
        border: '1px solid #F4F4F5',
        borderRadius: '12px',
        fontFamily: 'Noto Sans, sans-serif',
      }}
    >
      {props.children}
    </Container>
  )
}

export default MailContainer
