import { compileTemplate } from '../format-description'

describe('Basic description formatting', () => {
  it('should build to original text if no variables used', () => {
    const template = 'sample template with no vars'
    const compiled = compileTemplate(template)
    expect(compiled({})).toEqual(template)
    expect(compiled({ a: 42 })).toEqual(template)
    expect(compiled({ a: 'some value' })).toEqual(template)
  })
  it('should properly replace simple vars', () => {
    const template = '{{ var1 }}'
    const compiled = compileTemplate(template)
    expect(compiled({ var1: 42 })).toEqual('42')
  })
  it('should fail if var is missing in parameters', () => {
    const template = '{{ var1 }}'
    const compiled = compileTemplate(template)
    expect(() => compiled({})).toThrow()
  })
  it('should properly handle spaces around statements', () => {
    expect(compileTemplate('{{var1}}')({ var1: 42 })).toEqual('42')
    expect(compileTemplate('{{var1 }}')({ var1: 42 })).toEqual('42')
    expect(compileTemplate('{{var1   }}')({ var1: 42 })).toEqual('42')
    expect(compileTemplate('{{ var1}}')({ var1: 42 })).toEqual('42')
    expect(compileTemplate('{{    var1}}')({ var1: 42 })).toEqual('42')
    expect(compileTemplate('{{ var1 }}')({ var1: 42 })).toEqual('42')
    expect(compileTemplate('{{    var1    }}')({ var1: 42 })).toEqual('42')
  })
  it('should properly replace nested vars', () => {
    const template = '{{ var1.f1 }}'
    const compiled = compileTemplate(template)
    expect(compiled({ var1: { f1: 42 } })).toEqual('42')
  })
})

describe('Description formatting helpers', () => {
  it('possessive', () => {
    const template = '{{ possessive name }}'
    const compiled = compileTemplate(template)
    expect(compiled({ name: 'Nikolai' })).toEqual('Nikolai’s')
  })
})
