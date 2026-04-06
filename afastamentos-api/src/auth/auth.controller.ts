import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import type { Usuario } from '@prisma/client';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ValidateSecurityQuestionDto } from './dto/validate-security-question.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Public } from './public.decorator';
import { CurrentUser } from './current-user.decorator';
import { AnyAuthenticated } from './any-authenticated.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 tentativas por minuto
  @Post('login')
  login(@Body() loginDto: LoginDto, @Req() request: Request) {
    const ip = (request.ip || request.headers['x-forwarded-for'] || request.socket.remoteAddress || '') as string;
    const userAgent = (request.headers['user-agent'] || '') as string;
    return this.authService.login(loginDto.matricula, loginDto.senha, ip, userAgent);
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 tentativas por minuto
  @Post('forgot-password')
  forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto.matricula);
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 tentativas por minuto
  @Post('reset-password-by-security-question')
  resetPasswordBySecurityQuestion(
    @Body() validateDto: ValidateSecurityQuestionDto,
  ) {
    return this.authService.resetPasswordBySecurityQuestion(
      validateDto.matricula,
      validateDto.respostaSeguranca,
      validateDto.novaSenha,
    );
  }

  /** Perfil do usuário autenticado (para apps como Órion Suporte que não usam GET /usuarios/:id). */
  @Get('me')
  @AnyAuthenticated()
  me(@CurrentUser() user: Usuario) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { senhaHash, ...perfil } = user;
    return perfil;
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('change-password')
  changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() user: { id: number },
  ) {
    return this.authService.changePassword(user.id, dto.senhaAtual, dto.novaSenha);
  }
}
