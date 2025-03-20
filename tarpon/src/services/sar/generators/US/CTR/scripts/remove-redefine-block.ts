import fs from 'fs'
import path from 'path'
import xml2js, { Builder } from 'xml2js'
import { apiFetch } from '@/utils/api-fetch'

const tempFolder = './temp'

export const removeFolder = () => {
  if (fs.existsSync(tempFolder)) {
    fs.rmSync(tempFolder, { recursive: true, force: true })
  }
}

const createFolder = () => {
  if (!fs.existsSync(tempFolder)) {
    fs.mkdirSync(tempFolder)
  }
}

export const removeRedefine = async (
  pathToXML: string
): Promise<{ parentFolder: string; base: string; dependency: string[] }> => {
  return new Promise((resolve, reject) => {
    // ensure the xml file exists
    createFolder()

    const absolutePathForTempFolder = path.resolve(tempFolder)

    // Read XML file
    fs.readFile(pathToXML, 'utf-8', async (err, data) => {
      if (err) {
        removeFolder()
        reject('Error reading XML file:' + err)
      }

      // Convert XML to JavaScript object
      xml2js.parseString(data, async (err, result) => {
        if (err) {
          removeFolder()
          reject('Error reading XML file:' + err)
        }

        let schema = result['xsd:schema']
        const redefines = schema['xsd:redefine']
        if (!redefines || redefines.length === 0) {
          return
        }

        const importsMap: any[] = []
        let complexTypesMap: any[] = []
        const dependency: string[] = []

        for (let i = 0; i < redefines.length; i++) {
          const redefine = redefines[i]

          // download the file
          const url = redefine['$']['schemaLocation']
          const fileName = url.split('/')[url.split('/').length - 1]
          const filePath = absolutePathForTempFolder + '/' + fileName
          const { result } = await apiFetch(url)

          // update schemalocation
          redefine['$']['schemaLocation'] = './' + fileName

          // write to tempFolder
          fs.writeFileSync(
            filePath,
            (result as string).replace(
              '<?xml version="1.0" encoding="UTF-8"?>',
              ''
            )
          )

          // get complex elemetns
          const complexType = redefine['xsd:complexType']

          dependency.push(filePath)

          // complexType which need to be replaced with new names
          const nameToReplace: { [key: string]: string } = {}
          for (let j = 0; j < complexType.length; j++) {
            const type = complexType[j]
            const oldName = type['$']['name']
            const newName = 'Extentsion' + type['$']['name']
            type['$']['name'] = newName
            nameToReplace[oldName] = newName
          }

          // Replacing base names recursively
          for (const key of Object.keys(schema)) {
            if (key !== '$' && key !== 'xsd:redefine') {
              replaceBase(schema[key], nameToReplace)
            }
          }

          // updating namespace for redefine
          const value = redefine
          // value['namespace'] = namespace

          // updating base value for each complex type
          if (complexType) {
            complexTypesMap = [...complexTypesMap, ...complexType]
          }

          // importsMap.push({ $: { ...value['$'], namespace: namespace } })
          importsMap.push({ $: { ...value['$'] } })
        }

        schema = {
          'xsd:include': importsMap,
          'xsd:complexType': complexTypesMap,
          ...schema, // Keep the rest of the schema unchanged
        }

        delete schema['xsd:redefine']

        result['xsd:schema'] = schema

        // Parsing back to XML
        const builder = new Builder()
        const xml = builder.buildObject(result)

        const fileName = path.basename(pathToXML)
        const newXMLFilePath = absolutePathForTempFolder + '/' + fileName
        fs.writeFileSync(newXMLFilePath, xml)

        resolve({
          parentFolder: absolutePathForTempFolder,
          base: newXMLFilePath,
          dependency,
        })
      })
    })
  })
}

const replaceBase = (elements: any, mapping: { [key: string]: string }) => {
  if (typeof elements === 'object' && Array.isArray(elements)) {
    for (let i = 0; i < elements.length; i++) {
      const element = elements[i]
      const base = element.$?.base
      if (base && mapping[base]) {
        console.log('Replacing for', element.$.base)
        element.$.base = mapping[base]
      }

      // Recursively calling for each child
      if (typeof element === 'object') {
        for (const key of Object.keys(element)) {
          if (key !== '$' && key !== 'xsd:redefine') {
            replaceBase(element[key], mapping)
          }
        }
      }
    }
  }
}
