import path from 'path'
import fs from 'fs'
import libxmljs from 'libxmljs'

const run = async () => {
  const sarType = process.env.SAR_TYPE as 'STR' | 'CTR'
  if (!sarType) {
    throw new Error('SAR_TYPE is not set')
  }

  const xml = path.join(__dirname, 'test-sar.xml') // Replace with your SAR File Path or Create a test-sar.xml file in this directory
  const xmlFile = fs.readFileSync(xml, 'utf8')
  const xsd = path.join(__dirname, '..', sarType, 'resources', 'schema.xsd')
  const xsdFile = fs.readFileSync(xsd, 'utf8')
  const xsdDoc = libxmljs.parseXml(xsdFile)
  const xmlDoc = libxmljs.parseXml(xmlFile)

  const isValid = xmlDoc.validate(xsdDoc)

  if (isValid) {
    console.info('XML is valid')
  } else {
    console.info('XML is invalid')
    console.info(xmlDoc.validationErrors)
  }
}

void run()
