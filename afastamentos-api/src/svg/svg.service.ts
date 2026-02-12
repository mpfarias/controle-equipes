import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class SvgService {
  constructor(private readonly prisma: PrismaService) {}

  async listHorarios(): Promise<{ id: number; horaInicio: string; horaFim: string }[]> {
    return this.prisma.horarioSvg.findMany({
      where: { ativo: true },
      orderBy: [{ horaInicio: 'asc' }, { horaFim: 'asc' }],
    });
  }

  async createHorario(
    data: { horaInicio: string; horaFim: string },
  ): Promise<{ id: number; horaInicio: string; horaFim: string }> {
    const horaInicio = data.horaInicio.trim();
    const horaFim = data.horaFim.trim();

    const existente = await this.prisma.horarioSvg.findUnique({
      where: {
        horaInicio_horaFim: { horaInicio, horaFim },
      },
    });

    if (existente) {
      if (existente.ativo) {
        throw new BadRequestException(
          `Já existe um intervalo com horário ${horaInicio} às ${horaFim}.`,
        );
      }
      await this.prisma.horarioSvg.update({
        where: { id: existente.id },
        data: { ativo: true },
      });
      return this.prisma.horarioSvg.findUniqueOrThrow({
        where: { id: existente.id },
      });
    }

    return this.prisma.horarioSvg.create({
      data: { horaInicio, horaFim },
    });
  }

  async deleteHorario(id: number): Promise<void> {
    const existente = await this.prisma.horarioSvg.findUnique({
      where: { id },
    });

    if (!existente) {
      throw new BadRequestException('Intervalo não encontrado.');
    }

    await this.prisma.horarioSvg.update({
      where: { id },
      data: { ativo: false },
    });
  }
}
