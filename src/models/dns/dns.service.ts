import { Injectable } from '@nestjs/common'
import { DNSHeader, DNSPacket, DNSQuestion, DNSRecord } from './dns.interface'
import { concatenateUint8Arrays } from '../../common/helpers/uint8Array.helper'
import { Readable } from 'stream'

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

  parseDnsPacket(dnsPacketReader: Readable): DNSPacket {
    const header = this.parseHeader(dnsPacketReader)
    console.log('header', header)

    const questions = Array.from({ length: header.questionsQuantity }, () =>
      this.parseQuestion(dnsPacketReader),
    )
    const answers = Array.from({ length: header.answersQuantity }, () =>
      this.parseRecord(dnsPacketReader),
    )
    const authorities = Array.from({ length: header.authoritiesQuantity }, () =>
      this.parseRecord(dnsPacketReader),
    )
    const additionals = Array.from(
      { length: header.additionalRecordsQuantity },
      () => this.parseRecord(dnsPacketReader),
    )

    return {
      header,
      questions,
      answers,
      authorities,
      additionals,
    }
  }

  parseHeader(reader: Readable): DNSHeader {
    const bufferLength = 12
    const buffer = reader.read(bufferLength)

    if (buffer === null || buffer.length < bufferLength) {
      throw new Error('Invalid buffer or insufficient length')
    }

    const items = Array.from(Array(bufferLength).keys(), (index) =>
      buffer.readUInt16BE(index * 2),
    )

    return {
      id: items[0],
      flags: items[1],
      questionsQuantity: items[2],
      answersQuantity: items[3],
      authoritiesQuantity: items[4],
      additionalRecordsQuantity: items[5],
    }
  }

  parseQuestion(reader: Readable): DNSQuestion {
    const name = this.decodeName(reader)

    const questionDataLength = 4
    const data = reader.read(questionDataLength)

    if (data === null || data.length < questionDataLength) {
      throw new Error('Invalid data or insufficient length')
    }

    const type = data.readUInt16BE(0)
    const classData = data.readUInt16BE(2)

    console.log('type, classData', type, classData)

    return {
      name,
      type,
      class: classData,
    }
  }

  parseRecord(reader: Readable): DNSRecord {
    const name = this.decodeName(reader)
    const data = reader.read(10)

    if (data === null || data.length < 10) {
      throw new Error('Invalid data or insufficient length')
    }
    const type = data.readUInt16BE(0)
    const classData = data.readUInt16BE(2)
    const ttl = data.readUInt32BE(4)
    const dataLength = data.readUInt16BE(8)
    const recordData = reader.read(dataLength)

    if (recordData === null) {
      throw new Error('Insufficient data')
    }

    return {
      name,
      type,
      class: classData,
      ttl,
      data: recordData,
    }
  }

  decodeName(reader: Readable): Buffer {
    const nameParts: Buffer[] = []

    while (true) {
      const length = reader.read(1)?.[0]

      if (length === undefined || length === 0) {
        break
      }

      const isCompressed = length & 0b1100_0000

      if (isCompressed) {
        nameParts.push(this.decodeCompressedName(length, reader))
        break
      }

      const part = reader.read(length)

      if (part === null) {
        throw new Error('Insufficient data')
      }

      nameParts.push(part)
    }

    return Buffer.concat(nameParts)
  }

  decodeCompressedName(length: number, reader: Readable): Buffer {
    const pointerBytes = Buffer.from([length & 0b0011_1111])
    const nextByte = reader.read(1)

    if (nextByte === null) {
      throw new Error('Insufficient data')
    }

    pointerBytes[1] = nextByte[0]

    const currentPosition = reader.readableLength
    reader.push(null)
    reader.unshift(Buffer.alloc(0))
    reader.unshift(reader.read(currentPosition))
    reader.unshift(pointerBytes)
    const result = this.decodeName(reader)
    reader.unshift(Buffer.alloc(0))
    reader.unshift(reader.read(currentPosition))

    return result
  }
}
