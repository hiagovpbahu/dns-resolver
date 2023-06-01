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

  parseDnsPacket(dnsPacketReader: Buffer): DNSPacket {
    let currentPosition = 0

    const { position: afterHeaderPosition, ...header } = this.parseHeader(
      dnsPacketReader,
      currentPosition,
    )
    currentPosition = afterHeaderPosition

    const questions = Array.from({ length: header.questionsQuantity }, () => {
      const { position: afterQuestionPosition, ...question } =
        this.parseQuestion(dnsPacketReader, currentPosition)
      currentPosition = afterQuestionPosition
      return question
    })
    const answers = Array.from({ length: header.answersQuantity }, () => {
      const { position: afterAnswerPosition, ...record } = this.parseRecord(
        dnsPacketReader,
        currentPosition,
      )
      currentPosition = afterAnswerPosition
      return record
    })
    const authorities = Array.from(
      { length: header.authoritiesQuantity },
      () => {
        const { position: afterAnswerPosition, ...record } = this.parseRecord(
          dnsPacketReader,
          currentPosition,
        )
        currentPosition = afterAnswerPosition
        return record
      },
    )
    const additionals = Array.from(
      { length: header.additionalRecordsQuantity },
      () => {
        const { position: afterAnswerPosition, ...record } = this.parseRecord(
          dnsPacketReader,
          currentPosition,
        )
        currentPosition = afterAnswerPosition
        return record
      },
    )

    return {
      header,
      questions,
      answers,
      authorities,
      additionals,
    }
  }

  parseHeader(buffer: Buffer, position = 0): DNSHeader & { position: number } {
    const headerLength = 12

    if (buffer === null || buffer.length < headerLength) {
      throw new Error('Invalid buffer or insufficient length')
    }

    const items = Array.from(Array(headerLength).keys(), (index) =>
      buffer.readUInt16BE(index * 2),
    )

    return {
      id: items[0],
      flags: items[1],
      questionsQuantity: items[2],
      answersQuantity: items[3],
      authoritiesQuantity: items[4],
      additionalRecordsQuantity: items[5],
      position: position + headerLength,
    }
  }

  parseQuestion(
    buffer: Buffer,
    position = 0,
  ): DNSQuestion & { position: number } {
    const { name, position: currentPosition } = this.decodeName(
      buffer,
      position,
    )

    const questionDataLength = 4
    const finalPosition = questionDataLength + currentPosition

    if (buffer === null || buffer.length < finalPosition) {
      throw new Error('Invalid data or insufficient length')
    }

    const questionDataBuffer = buffer.subarray(currentPosition, finalPosition)
    const type = questionDataBuffer.readUInt16BE(0)
    const classData = questionDataBuffer.readUInt16BE(2)

    return {
      name,
      type,
      class: classData,
      position: finalPosition,
    }
  }

  parseRecord(buffer: Buffer, position = 0): DNSRecord & { position: number } {
    const { name, position: currentPosition } = this.decodeName(
      buffer,
      position,
    )

    const postDataPosition = currentPosition + 10
    const data = buffer.subarray(currentPosition, postDataPosition)

    if (data === null || data.length < 10) {
      throw new Error('Invalid data or insufficient length')
    }
    const type = data.readUInt16BE(0)
    const classData = data.readUInt16BE(2)
    const ttl = data.readUInt32BE(4)
    const dataLength = data.readUInt16BE(8)

    const finalPosition = postDataPosition + dataLength
    const recordData = buffer.subarray(postDataPosition, finalPosition)

    if (recordData === null) {
      throw new Error('Insufficient data')
    }

    return {
      name,
      type,
      class: classData,
      ttl,
      data: recordData,
      position: finalPosition,
    }
  }

  decodeName(buffer: Buffer, position = 0): { name: Buffer; position: number } {
    const nameParts: Buffer[] = []

    let currentPosition = position
    while (true) {
      const length = buffer[currentPosition]
      currentPosition++

      if (length === undefined || length === 0) {
        break
      }

      const isCompressed = length & 0b1100_0000

      if (isCompressed) {
        nameParts.push(
          this.decodeCompressedName(buffer, length, currentPosition),
        )
        currentPosition = position + 2
        break
      }

      const part = buffer.subarray(currentPosition, currentPosition + length)
      currentPosition += length

      if (part === null) {
        throw new Error('Insufficient data')
      }

      nameParts.push(part)

      if (
        buffer[currentPosition] !== undefined &&
        buffer[currentPosition] !== 0
      ) {
        nameParts.push(Buffer.from('.'))
      }
    }

    return {
      name: Buffer.concat(nameParts),
      position: currentPosition,
    }
  }

  decodeCompressedName(buffer: Buffer, length: number, position = 0): Buffer {
    const pointerBytes = Buffer.from([length & 0b0011_1111, buffer[position]])
    const pointer = pointerBytes.readUInt16BE(0)

    const result = this.decodeName(buffer, pointer)

    return result.name
  }
}
