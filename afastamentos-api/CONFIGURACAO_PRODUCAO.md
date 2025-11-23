# 🚀 Configuração do Resend para Produção

## 📋 Visão Geral

Para enviar emails para **qualquer destinatário** em produção, você precisa verificar um domínio no Resend. Isso permite:
- ✅ Enviar para qualquer email (não apenas o da conta)
- ✅ Melhor taxa de entrega (menos spam)
- ✅ Emails profissionais com seu domínio

## 🔧 Passo a Passo Completo

### 1. Acessar o Resend

1. Acesse: https://resend.com
2. Faça login na sua conta
3. Vá em **Domains** no menu lateral

### 2. Adicionar Domínio

1. Clique em **Add Domain**
2. Digite seu domínio (ex: `seudominio.com.br` ou `pm.sp.gov.br`)
3. Clique em **Add**

### 3. Configurar Registros DNS

O Resend mostrará **3 registros DNS** que você precisa adicionar no seu provedor de domínio:

#### Registro 1: SPF (TXT)
```
Tipo: TXT
Nome: @ (ou raiz do domínio)
Valor: v=spf1 include:resend.com ~all
TTL: 3600 (ou padrão)
```

#### Registro 2: DKIM (TXT)
```
Tipo: TXT
Nome: resend._domainkey (ou o nome fornecido pelo Resend)
Valor: [valor fornecido pelo Resend - será algo longo]
TTL: 3600 (ou padrão)
```

#### Registro 3: DMARC (TXT) - Opcional mas Recomendado
```
Tipo: TXT
Nome: _dmarc
Valor: v=DMARC1; p=none; rua=mailto:admin@seudominio.com.br
TTL: 3600 (ou padrão)
```

### 4. Onde Adicionar os Registros DNS?

Depende de onde seu domínio está hospedado:

#### Se for domínio da PM/Governo:
- Provavelmente gerenciado pelo setor de TI
- Entre em contato com o responsável pelo DNS
- Forneça os 3 registros acima

#### Se for domínio próprio:
- Acesse o painel do seu provedor (Registro.br, GoDaddy, etc.)
- Vá em "Gerenciar DNS" ou "Zona DNS"
- Adicione os registros conforme acima

### 5. Aguardar Verificação

1. Após adicionar os registros DNS, volte ao Resend
2. O status do domínio ficará como **"Pending"** (Pendente)
3. Aguarde alguns minutos (pode levar até 24 horas)
4. O status mudará para **"Verified"** (Verificado) quando estiver pronto

**💡 Dica**: Você pode clicar em "Verify" no Resend para verificar manualmente.

### 6. Configurar o .env

Após o domínio ser verificado, atualize o `.env`:

```env
RESEND_API_KEY="re_BAab68A8_7QMggcuFBEAVrsmumsJS1RFo"
RESEND_FROM_EMAIL="noreply@seudominio.com.br"  # Use seu domínio verificado
# RESEND_TEST_EMAIL="mpfarias85@gmail.com"  # Remova ou comente esta linha
FRONTEND_URL="https://seudominio.com.br"  # URL de produção
```

**⚠️ IMPORTANTE:**
- Use um email do seu domínio verificado (ex: `noreply@seudominio.com.br`)
- Remova ou comente a linha `RESEND_TEST_EMAIL`
- Atualize `FRONTEND_URL` para a URL de produção

### 7. Reiniciar o Servidor

```bash
cd afastamentos-api
npm run start:dev  # ou start:prod em produção
```

## ✅ Verificação

1. Teste enviando um email de recuperação de senha
2. Verifique se o email chega no destinatário correto
3. Verifique o dashboard do Resend: https://resend.com/emails

## 🔍 Troubleshooting

### Domínio não verifica

**Possíveis causas:**
1. Registros DNS não foram propagados (aguarde até 24h)
2. Registros DNS incorretos (verifique valores)
3. TTL muito alto (reduza para 3600)

**Solução:**
- Use ferramentas como https://mxtoolbox.com para verificar os registros
- Verifique se os valores estão exatamente como o Resend forneceu

### Emails ainda vão para spam

**Soluções:**
1. Configure o registro DMARC (passo 3)
2. Use um email profissional (noreply@seudominio.com.br)
3. Aguarde alguns dias para o domínio "aquecer" a reputação

### Erro "Domain not verified"

**Causa**: Domínio não está verificado ou email remetente não é do domínio

**Solução:**
- Verifique se o domínio está com status "Verified" no Resend
- Use um email do domínio verificado em `RESEND_FROM_EMAIL`

## 📞 Suporte

Se tiver problemas:
1. Verifique a documentação do Resend: https://resend.com/docs
2. Entre em contato com o suporte do Resend
3. Verifique os logs do servidor para erros específicos

## 🎯 Resumo Rápido

1. ✅ Adicione domínio no Resend
2. ✅ Configure 3 registros DNS no seu provedor
3. ✅ Aguarde verificação (até 24h)
4. ✅ Atualize `.env` com email do domínio
5. ✅ Remova `RESEND_TEST_EMAIL`
6. ✅ Reinicie servidor
7. ✅ Teste!

