import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrosService } from './erros.service';
import type { Usuario } from '@prisma/client';

@Injectable()
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly errosService: ErrosService) {}

  async catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : exception instanceof Error
          ? exception.message
          : 'Erro desconhecido';

    // Extrair mensagem de erro (pode ser string ou objeto)
    let mensagemErro = '';
    if (typeof message === 'string') {
      mensagemErro = message;
    } else if (typeof message === 'object' && message !== null) {
      const msgObj = message as { message?: string | string[] };
      if (Array.isArray(msgObj.message)) {
        mensagemErro = msgObj.message.join(', ');
      } else if (typeof msgObj.message === 'string') {
        mensagemErro = msgObj.message;
      } else {
        mensagemErro = JSON.stringify(message);
      }
    }

    // Extrair stack trace se disponível
    const stack = exception instanceof Error ? exception.stack : null;

    // Extrair informações do usuário (se autenticado)
    const user = (request as any).user as Usuario | undefined;
    const userId = user?.id || null;
    const userName = user?.nome || null;
    const matricula = user?.matricula || null;

    // Extrair informações da requisição
    const endpoint = request.url;
    const metodo = request.method;
    const ip = request.ip || request.headers['x-forwarded-for'] || request.socket.remoteAddress || null;
    const userAgent = request.headers['user-agent'] || null;
    const requestBody = request.body ? JSON.parse(JSON.stringify(request.body)) : null;

    // Preparar dados do erro para registro
    const erroData: Record<string, unknown> = {};
    if (exception instanceof Error) {
      erroData.name = exception.name;
      erroData.message = exception.message;
      if ('code' in exception) {
        erroData.code = (exception as any).code;
      }
      if ('meta' in exception) {
        erroData.meta = (exception as any).meta;
      }
    }

    // Registrar erro no banco de dados (não bloquear resposta se falhar)
    try {
      await this.errosService.registrarErro({
        mensagem: mensagemErro || 'Erro desconhecido',
        stack: stack || null,
        endpoint: endpoint || null,
        metodo: metodo || null,
        userId: userId || null,
        userName: userName || null,
        matricula: matricula || null,
        ip: typeof ip === 'string' ? ip : Array.isArray(ip) ? ip[0] : null,
        userAgent: typeof userAgent === 'string' ? userAgent : null,
        requestBody: requestBody,
        statusCode: status,
        erro: Object.keys(erroData).length > 0 ? erroData : null,
      });
    } catch (error) {
      // Não lançar erro aqui para evitar loop infinito
      console.error('Erro ao registrar erro no banco:', error);
    }

    // Responder ao cliente
    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: mensagemErro,
      ...(process.env.NODE_ENV === 'development' && stack && { stack }),
    });
  }
}
