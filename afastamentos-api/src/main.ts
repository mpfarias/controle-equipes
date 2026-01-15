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
  app.use(helmet({
    contentSecurityPolicy: false, // Desabilitar CSP para permitir flexibilidade (pode ser configurado depois)
    crossOriginEmbedderPolicy: false, // Desabilitar para permitir recursos externos se necessário
  }));
  
  // Configurar CORS com origens permitidas
  const allowedOrigins = [
    'http://localhost:5173', // Vite dev server
    'http://localhost:4173', // Vite preview
    'http://127.0.0.1:5173',
    'http://127.0.0.1:4173',
  ];
  
  // Adicionar origem customizada se definida em variável de ambiente
  const frontendUrl = process.env.FRONTEND_URL;
  if (frontendUrl) {
    allowedOrigins.push(frontendUrl);
  }
  
  app.enableCors({
    origin: allowedOrigins,
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

  const port = 3002;
  await app.listen(port, '0.0.0.0');
  const host = process.env.SERVER_HOST ?? 'localhost';
  console.log(`🚀 API disponível em:`);
  console.log(`   • http://localhost:${port}`);
  console.log(`   • http://${host}:${port}`);
}
bootstrap();
