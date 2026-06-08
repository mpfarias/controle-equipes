import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { json } from 'express';
import { AppModule } from './app.module';
import { ensureInitialUser } from './on-startup';

async function bootstrap() {
  // Garantir que o usuário inicial existe antes de iniciar a API
  await ensureInitialUser();

  const app = await NestFactory.create(AppModule);
  
  // Aumentar o limite do body parser para permitir upload de imagens em base64 (até 10MB)
  app.use(json({ limit: '10mb' }));
  
  // Configurar Helmet para adicionar headers de segurança
  const isProduction = process.env.NODE_ENV === 'production';
  const frontendUrl = process.env.FRONTEND_URL;
  const apiUrl = process.env.API_URL;
  const connectSrc = ["'self'"];
  if (frontendUrl) connectSrc.push(frontendUrl);
  if (apiUrl) connectSrc.push(apiUrl);
  app.use(helmet({
    contentSecurityPolicy: isProduction ? {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        fontSrc: ["'self'", 'data:'],
        connectSrc,
      },
    } : false, // Em desenvolvimento manter flexível
    crossOriginEmbedderPolicy: false, // Desabilitar para permitir recursos externos se necessário
  }));
  
  // Configurar CORS com origens permitidas
  const orionSuporteUrl = process.env.ORION_SUPORTE_FRONTEND_URL;

  const allowedOrigins = [
    'http://10.95.91.53:5173', // Frontend em produção na rede local
    'http://localhost:5173', // Preview prod local Órion SAD
    'http://localhost:5180', // Preview prod local Órion Suporte
    'http://localhost:5182', // Preview prod local Órion Qualidade
    'http://localhost:5183', // Preview prod local Órion Jurídico
    'http://localhost:5184', // Preview prod local Órion Patrimônio
    'http://localhost:5185', // Preview prod local Órion Mulher
    'http://localhost:5186', // Preview prod local Órion Agenda
    'http://localhost:5187', // Preview prod local Órion Operações
    'http://localhost:6173', // Vite dev Órion SAD
    'http://localhost:6180', // Vite dev Órion Suporte
    'http://localhost:6182', // Vite dev Órion Qualidade
    'http://localhost:6183', // Vite dev Órion Jurídico
    'http://localhost:6184', // Vite dev Órion Patrimônio
    'http://localhost:6185', // Vite dev Órion Mulher
    'http://localhost:6186', // Vite dev Órion Agenda
    'http://localhost:6187', // Vite dev Órion Operações
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5180',
    'http://127.0.0.1:5182',
    'http://127.0.0.1:5183',
    'http://127.0.0.1:5184',
    'http://127.0.0.1:5185',
    'http://127.0.0.1:5186',
    'http://127.0.0.1:5187',
    'http://127.0.0.1:6173',
    'http://127.0.0.1:6180',
    'http://127.0.0.1:6182',
    'http://127.0.0.1:6183',
    'http://127.0.0.1:6184',
    'http://127.0.0.1:6185',
    'http://127.0.0.1:6186',
    'http://127.0.0.1:6187',
    'https://afastamentos-web-wjeog.ondigitalocean.app',
  ];

  // Adicionar origem customizada se definida em variável de ambiente
  if (frontendUrl) {
    allowedOrigins.push(frontendUrl);
  }
  if (orionSuporteUrl) {
    allowedOrigins.push(orionSuporteUrl);
  }

  app.enableCors({
    origin: isProduction ? allowedOrigins : true,
    credentials: true, // Permite cookies e headers de autenticação
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });
  
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const port = Number(process.env.PORT ?? 3002);
  await app.listen(port, '0.0.0.0');
  const host = process.env.SERVER_HOST ?? 'localhost';
  console.log(`🚀 API disponível em:`);
  console.log(`   • http://localhost:${port}`);
  console.log(`   • http://${host}:${port}`);
}
bootstrap();
