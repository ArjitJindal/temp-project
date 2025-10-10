import { Font, Head } from '@react-email/components'
import React from 'react'

function MailHead() {
  return (
    <Head>
      <Font
        fontFamily="Noto Sans,sans-serif"
        fallbackFontFamily="Verdana, Geneva, sans-serif"
        webFont={{
          url: 'https://fonts.googleapis.com/css?family=Noto+Sans:400,700',
        }}
        fontWeight={400}
        fontStyle="normal"
      />
      <Font
        fontFamily="Noto Sans,sans-serif"
        fallbackFontFamily="Verdana, Geneva, sans-serif"
        webFont={{
          url: 'https://fonts.googleapis.com/css?family=Noto+Sans:400,700',
        }}
        fontWeight={700}
        fontStyle="normal"
      />
    </Head>
  )
}

export default MailHead
