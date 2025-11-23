import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ValidateSecurityQuestionDto } from './dto/validate-security-question.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto.matricula, loginDto.senha);
  }

  @Post('forgot-password')
  forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto.matricula);
  }

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
