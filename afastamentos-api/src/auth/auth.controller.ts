import { Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ValidateSecurityQuestionDto } from './dto/validate-security-question.dto';
import { Public } from './public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 tentativas por minuto
  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto.matricula, loginDto.senha);
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
}
