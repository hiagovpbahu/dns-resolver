import { Module } from '@nestjs/common'
import { DnsModule } from './models/dns/dns.module'

@Module({
  imports: [DnsModule],
})
export class AppModule {}
