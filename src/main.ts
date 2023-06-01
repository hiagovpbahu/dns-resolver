import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { Logger, ValidationPipe } from '@nestjs/common'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
  await app.listen(3000)
}

bootstrap().catch((error) => {
  const bootstrapLogger = new Logger()

  bootstrapLogger.error(error)
})
