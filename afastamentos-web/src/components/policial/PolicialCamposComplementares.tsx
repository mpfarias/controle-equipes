import { useEffect, useRef, useState } from 'react';
import {
  Box,
  Checkbox,
  FormControlLabel,
  Grid,
  MenuItem,
  Radio,
  RadioGroup,
  Stack,
  TextField,
} from '@mui/material';
import type { PolicialSexo, PolicialStatus } from '../../types';
import {
  CATEGORIAS_CNH,
  CONDICOES_DEPENDENTE,
  OPCOES_QUANTIDADE_DEPENDENTES,
  UFS_BRASIL,
} from '../../constants/policialDados';
import { buscarEnderecoPorCep } from '../../utils/buscarCep';
import {
  cepToDigits,
  maskCep,
  maskCpf,
  maskTelefone,
  maskTelefoneEmergencia,
  cpfToDigits,
  telefoneToDigits,
  validarCpf,
} from '../../utils/inputUtils';
import type {
  PolicialCamposComplementaresErrors,
  PolicialCamposComplementaresForm,
} from '../../utils/policialCamposComplementaresForm';
import { resizeDependentes } from '../../utils/policialCamposComplementaresForm';
import type { PolicialDependenteCondicao } from '../../types';
import { PolicialFormSection } from './PolicialFormSection';
import { PolicialRadioRow } from './PolicialRadioRow';
import { PolicialFormacaoListaCampo } from './PolicialFormacaoListaCampo';

export type PolicialContactFieldsProps = {
  cpf: string;
  telefone: string;
  dataNascimento: string;
  cpfError?: string | null;
  telefoneError?: string | null;
  onCpfChange: (value: string) => void;
  onTelefoneChange: (value: string) => void;
  onDataNascimentoChange: (value: string) => void;
  onCpfBlur?: () => void;
  onTelefoneBlur?: () => void;
};

type PolicialCamposComplementaresProps = {
  values: PolicialCamposComplementaresForm;
  onChange: (patch: Partial<PolicialCamposComplementaresForm>) => void;
  errors: PolicialCamposComplementaresErrors;
  onClearError: (field: keyof PolicialCamposComplementaresErrors) => void;
  status: PolicialStatus;
  formFieldSx?: object;
  contactFields?: PolicialContactFieldsProps;
  /** Oculta data de admissão (renderizada em «Dados funcionais» no cadastro). */
  hideDataAdmissao?: boolean;
};

export function PolicialCamposComplementares({
  values,
  onChange,
  errors,
  onClearError,
  status,
  formFieldSx,
  contactFields,
  hideDataAdmissao = false,
}: PolicialCamposComplementaresProps) {
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [cepLookupErro, setCepLookupErro] = useState<string | null>(null);
  const ultimoCepBuscado = useRef<string>('');

  const enderecoManual = values.enderecoSemCep;
  const enderecoBloqueado = !enderecoManual;
  const qtdDependentes =
    values.quantidadeDependentes === '' ? 0 : values.quantidadeDependentes;

  useEffect(() => {
    if (enderecoManual) {
      setCepLookupErro(null);
      ultimoCepBuscado.current = '';
      return;
    }
    const digits = cepToDigits(values.cep);
    if (digits.length !== 8) {
      setCepLookupErro(null);
      if (digits.length < 8) ultimoCepBuscado.current = '';
      return;
    }
    if (ultimoCepBuscado.current === digits) return;

    let cancelado = false;
    ultimoCepBuscado.current = digits;
    setBuscandoCep(true);
    setCepLookupErro(null);

    void buscarEnderecoPorCep(digits).then((endereco) => {
      if (cancelado) return;
      setBuscandoCep(false);
      if (!endereco) {
        setCepLookupErro('CEP não encontrado.');
        onChange({ logradouro: '', cidade: '', estado: '' });
        return;
      }
      onChange({
        logradouro: endereco.logradouro,
        cidade: endereco.cidade,
        estado: endereco.estado,
      });
    });

    return () => {
      cancelado = true;
    };
  }, [values.cep, enderecoManual, onChange]);

  const handleSemCepChange = (checked: boolean) => {
    onChange({
      enderecoSemCep: checked,
      ...(checked ? { cep: '' } : { logradouro: '', cidade: '', estado: '' }),
    });
    setCepLookupErro(null);
    ultimoCepBuscado.current = '';
    onClearError('cep');
  };

  const handleQuantidadeDependentesChange = (qtd: number) => {
    onChange({
      quantidadeDependentes: qtd,
      dependentes: resizeDependentes(values.dependentes, qtd),
    });
  };

  const patchDependente = (index: number, patch: Partial<PolicialCamposComplementaresForm['dependentes'][number]>) => {
    const next = [...values.dependentes];
    next[index] = { ...next[index], ...patch };
    if (patch.condicao && patch.condicao !== 'OUTROS') {
      next[index].condicaoOutros = '';
    }
    onChange({ dependentes: next });
  };

  const cepHelper =
    errors.cep || cepLookupErro || (buscandoCep ? 'Buscando endereço…' : undefined);

  return (
    <Stack spacing={3}>
      <PolicialFormSection title="Dados pessoais">
        <Grid container spacing={2}>
          {contactFields ? (
            <>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <TextField
                  label="CPF"
                  fullWidth
                  size="small"
                  value={contactFields.cpf}
                  onChange={(e) => contactFields.onCpfChange(maskCpf(e.target.value))}
                  onBlur={contactFields.onCpfBlur}
                  placeholder="000.000.000-00"
                  slotProps={{ htmlInput: { maxLength: 14 } }}
                  error={!!contactFields.cpfError}
                  helperText={contactFields.cpfError}
                  sx={formFieldSx}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <TextField
                  label="Telefone"
                  fullWidth
                  size="small"
                  value={contactFields.telefone}
                  onChange={(e) => contactFields.onTelefoneChange(maskTelefone(e.target.value))}
                  onBlur={contactFields.onTelefoneBlur}
                  placeholder="(00)00000-0000"
                  slotProps={{ htmlInput: { maxLength: 14 } }}
                  error={!!contactFields.telefoneError}
                  helperText={contactFields.telefoneError}
                  sx={formFieldSx}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <TextField
                  label="Data de nascimento"
                  fullWidth
                  size="small"
                  type="date"
                  value={contactFields.dataNascimento}
                  onChange={(e) => contactFields.onDataNascimentoChange(e.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                  sx={formFieldSx}
                />
              </Grid>
            </>
          ) : null}

          <Grid size={{ xs: 12, sm: 6, md: contactFields ? 3 : 4 }}>
            <TextField
              label="E-mail"
              fullWidth
              size="small"
              type="email"
              value={values.email}
              onChange={(e) => {
                onChange({ email: e.target.value });
                onClearError('email');
              }}
              placeholder="email@exemplo.com"
              error={!!errors.email}
              helperText={errors.email}
              sx={formFieldSx}
            />
          </Grid>

          {!hideDataAdmissao && status !== 'COMISSIONADO' ? (
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <TextField
                label="Data de admissão"
                fullWidth
                size="small"
                type="date"
                required
                value={values.dataAdmissao}
                onChange={(e) => {
                  onChange({ dataAdmissao: e.target.value });
                  onClearError('dataAdmissao');
                }}
                slotProps={{ inputLabel: { shrink: true } }}
                error={!!errors.dataAdmissao}
                helperText={errors.dataAdmissao}
                sx={formFieldSx}
              />
            </Grid>
          ) : null}

          <Grid size={{ xs: 12 }}>
            <PolicialRadioRow label="Sexo" required error={errors.sexo}>
              <RadioGroup
                row
                value={values.sexo}
                onChange={(e) => {
                  onChange({ sexo: e.target.value as PolicialSexo });
                  onClearError('sexo');
                }}
                sx={{ gap: 0.5 }}
              >
                <FormControlLabel
                  value="MASCULINO"
                  control={<Radio size="small" />}
                  label="Masculino"
                  labelPlacement="end"
                />
                <FormControlLabel
                  value="FEMININO"
                  control={<Radio size="small" />}
                  label="Feminino"
                  labelPlacement="end"
                />
              </RadioGroup>
            </PolicialRadioRow>
          </Grid>
        </Grid>

        <Box
          sx={{
            mt: 2.5,
            pt: 2,
            borderTop: '1px dashed',
            borderColor: 'var(--border-soft, divider)',
          }}
        >
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 4, md: 3 }}>
              <TextField
                label="CEP"
                fullWidth
                size="small"
                value={values.cep}
                disabled={enderecoManual}
                onChange={(e) => {
                  onChange({ cep: maskCep(e.target.value) });
                  onClearError('cep');
                  setCepLookupErro(null);
                  if (cepToDigits(e.target.value).length < 8) {
                    ultimoCepBuscado.current = '';
                    onChange({ logradouro: '', cidade: '', estado: '' });
                  }
                }}
                placeholder="00000-000"
                slotProps={{ htmlInput: { maxLength: 9 } }}
                error={!!errors.cep || !!cepLookupErro}
                helperText={cepHelper}
                sx={formFieldSx}
              />
            </Grid>

            <Grid
              size={{ xs: 12, sm: 8, md: 9 }}
              sx={{ display: 'flex', alignItems: 'center' }}
            >
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={values.enderecoSemCep}
                    onChange={(e) => handleSemCepChange(e.target.checked)}
                  />
                }
                label="Não sabe o CEP — preencher manualmente"
                labelPlacement="end"
                sx={{ m: 0, alignItems: 'center' }}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 8 }}>
              <TextField
                label="Logradouro"
                fullWidth
                size="small"
                value={values.logradouro}
                disabled={enderecoBloqueado}
                onChange={(e) => onChange({ logradouro: e.target.value })}
                sx={formFieldSx}
              />
            </Grid>

            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                label="Complemento"
                fullWidth
                size="small"
                value={values.complemento}
                onChange={(e) => onChange({ complemento: e.target.value })}
                sx={formFieldSx}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 8, md: 8 }}>
              <TextField
                label="Cidade"
                fullWidth
                size="small"
                value={values.cidade}
                disabled={enderecoBloqueado}
                onChange={(e) => onChange({ cidade: e.target.value })}
                sx={formFieldSx}
              />
            </Grid>

            <Grid size={{ xs: 12, sm: 4, md: 4 }}>
              <TextField
                select
                label="Estado"
                fullWidth
                size="small"
                value={values.estado}
                disabled={enderecoBloqueado}
                onChange={(e) => onChange({ estado: e.target.value })}
                slotProps={{ inputLabel: { shrink: true } }}
                sx={formFieldSx}
              >
                <MenuItem value="">
                  <em>Selecione</em>
                </MenuItem>
                {UFS_BRASIL.map((uf) => (
                  <MenuItem key={uf.sigla} value={uf.sigla}>
                    {uf.sigla}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
          </Grid>
        </Box>

        <Box
          sx={{
            mt: 2.5,
            pt: 2,
            borderTop: '1px dashed',
            borderColor: 'var(--border-soft, divider)',
          }}
        >
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                label="Contato de emergência — nome"
                fullWidth
                size="small"
                value={values.contatoEmergenciaNome}
                onChange={(e) => onChange({ contatoEmergenciaNome: e.target.value })}
                sx={formFieldSx}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                label="Contato de emergência — telefone"
                fullWidth
                size="small"
                value={values.contatoEmergenciaTelefone}
                onChange={(e) => {
                  onChange({ contatoEmergenciaTelefone: maskTelefoneEmergencia(e.target.value) });
                  onClearError('contatoEmergenciaTelefone');
                }}
                placeholder="(00)9 0000-0000"
                slotProps={{ htmlInput: { maxLength: 16 } }}
                error={!!errors.contatoEmergenciaTelefone}
                helperText={errors.contatoEmergenciaTelefone || 'Formato: (xx)x xxxx-xxxx'}
                sx={formFieldSx}
              />
            </Grid>
          </Grid>
        </Box>
      </PolicialFormSection>

      <PolicialFormSection title="Dados familiares">
        <Stack spacing={2}>
          <PolicialRadioRow label="Dependentes">
            <RadioGroup
              row
              value={values.quantidadeDependentes === '' ? '' : String(values.quantidadeDependentes)}
              onChange={(e) => handleQuantidadeDependentesChange(Number(e.target.value))}
              sx={{ flexWrap: 'wrap', gap: 0.25 }}
            >
              {OPCOES_QUANTIDADE_DEPENDENTES.map((op) => (
                <FormControlLabel
                  key={op.value}
                  value={String(op.value)}
                  control={<Radio size="small" />}
                  label={op.label}
                  labelPlacement="end"
                  sx={{ mr: 1 }}
                />
              ))}
            </RadioGroup>
          </PolicialRadioRow>

          {qtdDependentes > 0 ? (
            <Stack spacing={2}>
              {values.dependentes.map((dep, index) => (
                <Grid container spacing={2} key={index} alignItems="flex-start">
                  <Grid size={{ xs: 12, md: 5 }}>
                    <TextField
                      label={`Dependente (${index + 1}) — nome`}
                      fullWidth
                      size="small"
                      value={dep.nome}
                      onChange={(e) => patchDependente(index, { nome: e.target.value })}
                      sx={formFieldSx}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <TextField
                      select
                      label="Condição"
                      fullWidth
                      size="small"
                      value={dep.condicao}
                      onChange={(e) =>
                        patchDependente(index, {
                          condicao: e.target.value as PolicialDependenteCondicao | '',
                        })
                      }
                      slotProps={{ inputLabel: { shrink: true } }}
                      sx={formFieldSx}
                    >
                      <MenuItem value="">
                        <em>Selecione</em>
                      </MenuItem>
                      {CONDICOES_DEPENDENTE.map((op) => (
                        <MenuItem key={op.value} value={op.value}>
                          {op.label}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                  {dep.condicao === 'OUTROS' ? (
                    <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                      <TextField
                        label="Especifique a condição"
                        fullWidth
                        size="small"
                        value={dep.condicaoOutros}
                        onChange={(e) => patchDependente(index, { condicaoOutros: e.target.value })}
                        sx={formFieldSx}
                      />
                    </Grid>
                  ) : null}
                </Grid>
              ))}
            </Stack>
          ) : null}

          <PolicialRadioRow label="Doador de órgãos?">
            <RadioGroup
              row
              value={values.doadorOrgaos}
              onChange={(e) =>
                onChange({
                  doadorOrgaos: e.target.value as PolicialCamposComplementaresForm['doadorOrgaos'],
                })
              }
            >
              <FormControlLabel
                value="SIM"
                control={<Radio size="small" />}
                label="Sim"
                labelPlacement="end"
              />
              <FormControlLabel
                value="NAO"
                control={<Radio size="small" />}
                label="Não"
                labelPlacement="end"
              />
            </RadioGroup>
          </PolicialRadioRow>
        </Stack>
      </PolicialFormSection>

      <PolicialFormSection title="Habilitação">
        <Grid container spacing={2} alignItems="center">
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <TextField
              select
              label="Categoria CNH"
              fullWidth
              size="small"
              value={values.categoriaCnh}
              disabled={values.cnhNaoHabilitado}
              onChange={(e) =>
                onChange({
                  categoriaCnh: e.target.value as PolicialCamposComplementaresForm['categoriaCnh'],
                })
              }
              slotProps={{ inputLabel: { shrink: true } }}
              sx={formFieldSx}
            >
              <MenuItem value="">
                <em>Selecione</em>
              </MenuItem>
              {CATEGORIAS_CNH.map((cat) => (
                <MenuItem key={cat} value={cat}>
                  {cat}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={values.cnhNaoHabilitado}
                  onChange={(e) =>
                    onChange({
                      cnhNaoHabilitado: e.target.checked,
                      ...(e.target.checked ? { categoriaCnh: '' } : {}),
                    })
                  }
                />
              }
              label="Não habilitado"
              labelPlacement="end"
              sx={{ m: 0, alignItems: 'center' }}
            />
          </Grid>
        </Grid>
      </PolicialFormSection>

      <PolicialFormSection title="Formação acadêmica">
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <PolicialFormacaoListaCampo
              label="Nível superior em"
              items={values.nivelSuperiorEm}
              draft={values.nivelSuperiorEmInput}
              onDraftChange={(value) => onChange({ nivelSuperiorEmInput: value })}
              onAdd={() => {
                const texto = values.nivelSuperiorEmInput.trim();
                if (texto.length < 3) return;
                const key = texto.toLowerCase();
                if (values.nivelSuperiorEm.some((item) => item.toLowerCase() === key)) {
                  onChange({ nivelSuperiorEmInput: '' });
                  return;
                }
                onChange({
                  nivelSuperiorEm: [...values.nivelSuperiorEm, texto],
                  nivelSuperiorEmInput: '',
                });
              }}
              onRemove={(index) =>
                onChange({
                  nivelSuperiorEm: values.nivelSuperiorEm.filter((_, i) => i !== index),
                })
              }
              formFieldSx={formFieldSx}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <PolicialFormacaoListaCampo
              label="Cursos civis e/ou militares"
              items={values.cursosCivisMilitares}
              draft={values.cursosCivisMilitaresInput}
              onDraftChange={(value) => onChange({ cursosCivisMilitaresInput: value })}
              onAdd={() => {
                const texto = values.cursosCivisMilitaresInput.trim();
                if (texto.length < 3) return;
                const key = texto.toLowerCase();
                if (values.cursosCivisMilitares.some((item) => item.toLowerCase() === key)) {
                  onChange({ cursosCivisMilitaresInput: '' });
                  return;
                }
                onChange({
                  cursosCivisMilitares: [...values.cursosCivisMilitares, texto],
                  cursosCivisMilitaresInput: '',
                });
              }}
              onRemove={(index) =>
                onChange({
                  cursosCivisMilitares: values.cursosCivisMilitares.filter((_, i) => i !== index),
                })
              }
              formFieldSx={formFieldSx}
            />
          </Grid>
        </Grid>
      </PolicialFormSection>
    </Stack>
  );
}

/** Handlers padrão de blur para CPF/telefone (uso no cadastro). */
export function blurValidacaoCpfTelefone(
  cpf: string,
  telefone: string,
  setCpfError: (msg: string | null) => void,
  setTelefoneError: (msg: string | null) => void,
) {
  const cpfDigits = cpfToDigits(cpf);
  if (cpfDigits.length === 11 && !validarCpf(cpf)) {
    setCpfError('CPF inválido (dígitos verificadores incorretos).');
  } else if (cpfDigits.length > 0 && cpfDigits.length !== 11) {
    setCpfError('CPF deve conter 11 dígitos.');
  } else {
    setCpfError(null);
  }

  const telefoneDigits = telefoneToDigits(telefone);
  if (telefoneDigits.length > 0 && telefoneDigits.length !== 11) {
    setTelefoneError('Telefone deve conter 11 dígitos.');
  } else {
    setTelefoneError(null);
  }
}
