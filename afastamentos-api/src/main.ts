import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const port = 3002;
  await app.listen(port, '0.0.0.0');
  const host = process.env.SERVER_HOST ?? 'localhost';
  console.log(`🚀 API disponível em:`);
  console.log(`   • http://localhost:${port}`);
  console.log(`   • http://${host}:${port}`);
}
bootstrap();
