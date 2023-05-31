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
