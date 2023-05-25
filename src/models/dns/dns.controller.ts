import { Controller, Get, Param } from '@nestjs/common'
import { DnsService } from './dns.service'

@Controller('dns')
export class DnsController {
  constructor(private readonly dnsService: DnsService) {}

  @Get()
  getResolvedDns(@Param('url') url: string): string {
    return this.dnsService.resolveDns(url)
  }
}
