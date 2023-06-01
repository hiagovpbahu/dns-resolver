export interface DNSPacket {
  header: DNSHeader
  questions: DNSQuestion[]
  answers: DNSRecord[]
  authorities: DNSRecord[]
  additionals: DNSRecord[]
}

export interface DNSHeader {
  id: number
  flags: number
  questionsQuantity?: number
  answersQuantity?: number
  authoritiesQuantity?: number
  additionalRecordsQuantity?: number
}

export interface DNSQuestion {
  name: Uint8Array
  type: number
  class: number
}

export interface DNSRecord {
  name: Uint8Array
  type: number
  class: number
  ttl: number
  data: Uint8Array
}

export interface ReadableDNSPacket {
  header: DNSHeader
  questions: ReadableDNSQuestion[]
  answers: ReadableDNSRecord[]
  authorities: ReadableDNSRecord[]
  additionals: ReadableDNSRecord[]
}

export interface ReadableDNSQuestion extends Omit<DNSQuestion, 'name'> {
  name: string
}

export interface ReadableDNSRecord extends Omit<DNSRecord, 'name' | 'data'> {
  name: string
  data: string
}
