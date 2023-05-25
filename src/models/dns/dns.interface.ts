export interface DNSHeader {
  id: number
  flags: number
  questionsQuantity?: number
  answersQuantity?: number
  authoritiesQuantity?: number
  additionalRecordsQuantity?: number
}

export interface DNSQuestion {
  name: string
  type: number
  class: number
}
