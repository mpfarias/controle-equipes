# 👤 Criar Usuário Inicial

Depois de configurar o banco de dados, você precisa criar um usuário para fazer login no sistema.

## Método 1: Script Node.js (Recomendado)

### Passo 1: Criar o script

Crie um arquivo `create-user.js` na pasta `afastamentos-api`:

```javascript
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createUser() {
  try {
    // Solicitar dados do usuário
    const nome = process.argv[2] || 'ADMINISTRADOR';
    const matricula = process.argv[3] || 'admin';
    const senha = process.argv[4] || 'admin123';
    const equipe = (process.argv[5] || 'A').toUpperCase();

    // Gerar hash da senha
    const senhaHash = await bcrypt.hash(senha, 10);

    // Criar usuário
    const usuario = await prisma.usuario.create({
      data: {
        nome: nome.toUpperCase(),
        matricula: matricula.toUpperCase(),
        senhaHash,
        equipe: equipe,
        status: 'ATIVO',
      },
    });

    console.log('✅ Usuário criado com sucesso!');
    console.log('📋 Dados do usuário:');
    console.log(`   Nome: ${usuario.nome}`);
    console.log(`   Matrícula: ${usuario.matricula}`);
    console.log(`   Equipe: ${usuario.equipe}`);
    console.log(`   Senha: ${senha} (anote essa senha!)`);
    console.log('\n🔑 Você pode fazer login com:');
    console.log(`   Matrícula: ${usuario.matricula}`);
    console.log(`   Senha: ${senha}`);
  } catch (error) {
    if (error.code === 'P2002') {
      console.error('❌ Erro: Matrícula já cadastrada!');
    } else {
      console.error('❌ Erro ao criar usuário:', error.message);
    }
  } finally {
    await prisma.$disconnect();
  }
}

createUser();
```

### Passo 2: Executar o script

```bash
cd afastamentos-api

# Com parâmetros personalizados
node create-user.js "SEU NOME" "sua_matricula" "sua_senha" "A"

# Ou com valores padrão (admin/admin123)
node create-user.js
```

**Exemplo:**
```bash
node create-user.js "JOÃO SILVA" "12345x" "minhasenha123" "A"
```

Isso criará um usuário:
- Nome: JOÃO SILVA
- Matrícula: 12345X
- Senha: minhasenha123
- Equipe: A

---

## Método 2: Usando Prisma Studio

### Passo 1: Abrir o Prisma Studio

```bash
cd afastamentos-api
npx prisma studio
```

Isso abrirá uma interface web em `http://localhost:5555`

### Passo 2: Criar usuário manualmente

1. Clique na tabela `Usuario`
2. Clique em "Add record"
3. Preencha os campos:
   - `nome`: SEU NOME (em maiúsculas)
   - `matricula`: sua_matricula (ex: 12345x)
   - `senhaHash`: **IMPORTANTE** - Você precisa gerar o hash da senha

### Passo 3: Gerar hash da senha

Abra um terminal Node.js e execute:

```javascript
const bcrypt = require('bcryptjs');
bcrypt.hash('sua_senha_aqui', 10).then(hash => console.log(hash));
```

Ou crie um script temporário:

```bash
node -e "const bcrypt=require('bcryptjs');bcrypt.hash('sua_senha',10).then(h=>console.log(h))"
```

Copie o hash gerado e cole no campo `senhaHash` no Prisma Studio.

4. `equipe`: A, B, C, D ou E
5. `status`: ATIVO
6. Clique em "Save 1 change"

---

## Método 3: SQL direto no banco

### Passo 1: Gerar hash da senha

Execute no terminal:

```bash
cd afastamentos-api
node -e "const bcrypt=require('bcryptjs');bcrypt.hash('sua_senha_aqui',10).then(h=>console.log(h))"
```

Copie o hash gerado.

### Passo 2: Inserir no banco

Conecte no MySQL:

```bash
mysql -u root -p afastamentos_db
```

Ou se usou Docker:

```bash
docker exec -it afastamentos-mysql mysql -u root -proot123 afastamentos_db
```

Execute o SQL:

```sql
INSERT INTO Usuario (nome, matricula, senhaHash, equipe, status, createdAt, updatedAt)
VALUES (
  'SEU NOME',
  'sua_matricula',
  'cole_o_hash_gerado_aqui',
  'A',
  'ATIVO',
  NOW(),
  NOW()
);
```

Substitua:
- `SEU NOME` pelo seu nome
- `sua_matricula` pela sua matrícula
- `cole_o_hash_gerado_aqui` pelo hash gerado no passo anterior
- `A` pela equipe desejada

---

## ✅ Verificar se o usuário foi criado

Você pode verificar de algumas formas:

### Via Prisma Studio
```bash
npx prisma studio
```

### Via MySQL
```sql
SELECT id, nome, matricula, equipe, status FROM Usuario;
```

---

## 🔐 Fazer login

Depois de criar o usuário:

1. Acesse o frontend: `http://localhost:5173`
2. Informe a **matrícula** (ex: 12345X)
3. Informe a **senha** que você usou
4. Clique em "Entrar"

---

## 📝 Dicas

- **Anote bem a senha!** O hash não pode ser revertido
- Se esquecer a senha, você precisará criar um novo usuário ou atualizar manualmente no banco
- Você pode criar quantos usuários quiser usando qualquer um dos métodos acima
- Usuários podem ser criados pela interface web depois do primeiro login

---

## ⚠️ Importante para produção

Em ambiente de produção, você deve:
- Usar senhas fortes
- Criar um script de seed oficial
- Não expor credenciais padrão
- Configurar políticas de senha

