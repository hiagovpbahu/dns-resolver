import { Test, TestingModule } from '@nestjs/testing'
import { DnsController } from './dns.controller'
import { DnsService } from './dns.service'

describe('DnsController', () => {
  let dnsController: DnsController

  beforeEach(async () => {
    const dns: TestingModule = await Test.createTestingModule({
      controllers: [DnsController],
      providers: [DnsService],
    }).compile()

    dnsController = dns.get<DnsController>(DnsController)
  })

  describe('Resolve DNS', () => {
    it('should return "93.184.216.34"', () => {
      expect(dnsController.getResolvedDns('example.com')).toBe('93.184.216.34')
    })
  })
})
