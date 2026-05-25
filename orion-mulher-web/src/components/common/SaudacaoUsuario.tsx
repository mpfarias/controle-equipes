import { Box } from '@mui/material';
import {
  formatNomeProprioExibicao,
  separarGraduacaoENome,
} from '../../utils/formatUsuarioExibicao';

type SaudacaoUsuarioProps = {
  nomeCompleto: string;
  /** Ex.: "Olá," ou "Bem-vindo(a)," */
  prefixo?: string;
  /** Destaca só a graduação; o nome segue em peso normal. */
  destacarGraduacao?: boolean;
};

export function SaudacaoUsuario({
  nomeCompleto,
  prefixo,
  destacarGraduacao = true,
}: SaudacaoUsuarioProps) {
  const { graduacao, nome } = separarGraduacaoENome(nomeCompleto);
  const gradFmt = graduacao.trim().toUpperCase();
  const nomeFmt = formatNomeProprioExibicao(nome || nomeCompleto);

  const corpo =
    gradFmt && destacarGraduacao ? (
      <>
        <Box component="strong" sx={{ fontWeight: 700 }}>
          {gradFmt}
        </Box>{' '}
        {nomeFmt}
      </>
    ) : (
      <Box component="strong" sx={{ fontWeight: 700 }}>
        {gradFmt ? `${gradFmt} ${nomeFmt}` : nomeFmt}
      </Box>
    );

  if (!prefixo) return <>{corpo}</>;

  return (
    <>
      {prefixo}{' '}
      {corpo}
    </>
  );
}
