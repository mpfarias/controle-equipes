import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { HealthModule } from './health/health.module';
import { PoliciaisModule } from './policiais/policiais.module';
import { AfastamentosModule } from './afastamentos/afastamentos.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './audit/audit.module';
import { RelatoriosModule } from './relatorios/relatorios.module';
import { ErrosModule } from './erros/erros.module';
import { AcessosModule } from './acessos/acessos.module';
import { RestricoesAfastamentoModule } from './restricoes-afastamento/restricoes-afastamento.module';
import { SvgModule } from './svg/svg.module';
import { EscalasModule } from './escalas/escalas.module';
import { TrocaServicoModule } from './troca-servico/troca-servico.module';
import { ErrorReportsModule } from './error-reports/error-reports.module';
import { OrionQualidadeModule } from './orion-qualidade/orion-qualidade.module';
import { OrionJuridicoModule } from './orion-juridico/orion-juridico.module';
import { OrionPatrimonioModule } from './orion-patrimonio/orion-patrimonio.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/roles.guard';
import { APP_FILTER } from '@nestjs/core';
import { HttpExceptionFilter } from './erros/http-exception.filter';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1 minuto
        limit: 300, // 300 requisições por minuto (evita ThrottlerException em buscas/autocomplete)
      },
    ]),
    HealthModule,
    PoliciaisModule,
    AfastamentosModule,
    UsuariosModule,
    AuthModule,
    AuditModule,
    RelatoriosModule,
    ErrosModule,
    AcessosModule,
    RestricoesAfastamentoModule,
    SvgModule,
    EscalasModule,
    TrocaServicoModule,
    ErrorReportsModule,
    OrionQualidadeModule,
    OrionJuridicoModule,
    OrionPatrimonioModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}