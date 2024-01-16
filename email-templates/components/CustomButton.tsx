import { Button, Text } from '@react-email/components'
import React from 'react'
interface Props {
  url: string
  text: string
}
function CustomButton(props: Props) {
  const { url, text } = props
  return (
    <Button
      style={{
        backgroundColor: '#1169F9',
        paddingTop: '8px',
        paddingBottom: '8px',
        width: '100%',
        textAlign: 'center',
        borderRadius: '6px',
      }}
      href={url}
    >
      <Text
        style={{
          color: '#FFFFFF',
          fontWeight: '600',
          margin: 0,
          padding: 0,
        }}
      >
        {text}
      </Text>
    </Button>
  )
}

export default CustomButton
