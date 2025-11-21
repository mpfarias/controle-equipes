import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module';
import { ColaboradoresModule } from './colaboradores/colaboradores.module';
import { AfastamentosModule } from './afastamentos/afastamentos.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    HealthModule,
    ColaboradoresModule,
    AfastamentosModule,
    UsuariosModule,
    AuthModule,
  ],
})
export class AppModule {}