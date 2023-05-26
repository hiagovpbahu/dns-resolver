import { Injectable } from '@nestjs/common'
import { decode as decodeDNSPacket } from 'dns-packet'
import { DNSHeader, DNSQuestion } from './dns.interface'
import { concatenateUint8Arrays } from '../../common/helpers/uint8Array.helper'

@Injectable()
export class DnsService {
  buildQuery(domainName: string, recordType: number): Uint8Array {
    const CLASS_IN = 1
    const RECURSION_DESIRED = 1 << 8

    const name = this.encodeDnsName(domainName)
    const id = Math.floor(Math.random() * 65536)

    const header: DNSHeader = {
      id,
      flags: RECURSION_DESIRED,
      questionsQuantity: 1,
      answersQuantity: 0,
      authoritiesQuantity: 0,
      additionalRecordsQuantity: 0,
    }
    const question: DNSQuestion = {
      name,
      type: recordType,
      class: CLASS_IN,
    }

    const headerBytes = this.headerToBytes(header)
    const questionBytes = this.questionToBytes(question)

    return new Uint8Array([...headerBytes, ...questionBytes])
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
    const buffer = new ArrayBuffer(question.name.length + 4)
    const dataView = new DataView(buffer)

    for (let offset = 0; offset < question.name.length; offset++) {
      dataView.setUint8(offset, question.name[offset])
    }

    const questionTypeOffset = question.name.length
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

  parseDnsResponse(response: Buffer) {
    const dnsPacket = decodeDNSPacket(response)

    if (dnsPacket.answers.length <= 0) {
      return {
        error: 'No answers found in the DNS response',
      }
    }

    const answer = dnsPacket.answers[0]

    return answer
  }
}
