import { Injectable } from '@nestjs/common'
import { DNSHeader, DNSQuestion } from './dns.interface'
import { concatenateUint8Arrays } from '../../common/helpers/uint8Array.helper'

@Injectable()
export class DnsService {
  resolveDns(url: string): string {
    return '93.184.216.34'
  }

  headerToBytes(header: DNSHeader) {
    const fields = Object.values(header)

    const buffer = new ArrayBuffer(fields.length * 2)
    const dataView = new DataView(buffer)

    fields.forEach((value, index) => {
      dataView.setUint16(index * 2, value, false)
    })

    const byteString = new Uint8Array(buffer)
    return byteString
  }

  questionToBytes(question: DNSQuestion) {
    const nameBytes = new TextEncoder().encode(question.name)

    const buffer = new ArrayBuffer(nameBytes.length + 4)
    const dataView = new DataView(buffer)

    for (let offset = 0; offset < nameBytes.length; offset++) {
      dataView.setUint8(offset, nameBytes[offset])
    }

    const questionTypeOffset = nameBytes.length
    dataView.setUint16(questionTypeOffset, question.type, false)

    const questionClassOffset = questionTypeOffset + 2
    dataView.setUint16(questionClassOffset, question.class, false)

    const byteString = new Uint8Array(buffer)
    return byteString
  }

  encodeDnsName(domainName: string): Uint8Array {
    const domainNameSections = domainName.split('.')

    const encodedDomainNameSections = domainNameSections.map(
      (domainNameSection) => {
        const domainNameSectionLength = domainNameSection.length
        const domainNameSectionBytes = new TextEncoder().encode(
          domainNameSection,
        )
        const lengthByte = new Uint8Array([domainNameSectionLength])

        return concatenateUint8Arrays(lengthByte, domainNameSectionBytes)
      },
    )

    const encodedDomainName = concatenateUint8Arrays(
      ...encodedDomainNameSections,
    )

    const nullByte = new Uint8Array([0])
    const encodedDomainNameWithNullByte = concatenateUint8Arrays(
      encodedDomainName,
      nullByte,
    )

    return encodedDomainNameWithNullByte
  }
}
