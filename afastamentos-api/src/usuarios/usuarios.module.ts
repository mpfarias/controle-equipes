import { Module } from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import { UsuariosController } from './usuarios.controller';
import { PrismaService } from '../prisma.service';
import { AuditService } from '../audit/audit.service';

@Module({
  controllers: [UsuariosController],
  providers: [UsuariosService, PrismaService, AuditService],
  exports: [UsuariosService],
})
export class UsuariosModule {}

