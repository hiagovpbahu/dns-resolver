import { Controller, Get, Param } from '@nestjs/common'
import { DnsService } from './dns.service'
import { createSocket } from 'dgram'

@Controller('dns')
export class DnsController {
  constructor(private readonly dnsService: DnsService) {}

  @Get(':url')
  async resolveDns(@Param('url') url: string) {
    const TYPE_A = 1

    const query = this.dnsService.buildQuery(url, TYPE_A)

    const socket = createSocket('udp4')
    const socketResponse = await new Promise<Buffer>((resolve, reject) => {
      socket.send(query, 0, query.length, 53, '8.8.8.8', (error) => {
        if (error) {
          reject(error)
        }

        socket.on('message', (response) => {
          resolve(response)
        })
      })
    })

    const dnsResponse = this.dnsService.parseDnsPacket(socketResponse)
    const readableDnsResponse =
      this.dnsService.getReadableDNSPacket(dnsResponse)

    return readableDnsResponse
  }
}
