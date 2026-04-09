const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  log(`\n[${step}] ${message}`, 'cyan');
}

function checkCommand(command) {
  try {
    execSync(command, { stdio: 'ignore', shell: true });
    return true;
  } catch {
    return false;
  }
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function checkDatabase(maxAttempts = 30) {
  // Step será atualizado no main
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      // Verifica se o container está rodando e saudável
      const output = execSync(
        'docker exec afastamentos-postgres pg_isready -U postgres',
        { stdio: 'ignore', shell: true }
      );
      log('✅ Banco de dados pronto!', 'green');
      await wait(2000); // Aguarda mais um pouco para garantir
      return true;
    } catch (error) {
      if (i < maxAttempts - 1) {
        log(`   Tentativa ${i + 1}/${maxAttempts}... Aguardando banco de dados...`, 'yellow');
        await wait(3000);
      }
    }
  }
  
  log('⚠️  Banco de dados pode não estar pronto, mas continuando...', 'yellow');
  log('   Se houver erros, aguarde alguns segundos e execute: npm run setup:db', 'yellow');
  return true; // Continua mesmo assim, o Prisma vai tentar conectar depois
}

async function main() {
  log('\n🚀 Setup Automático - Sistema de Controle de Afastamentos\n', 'blue');
  
  // Verificar Docker
  if (!checkCommand('docker --version')) {
    log('❌ Docker não encontrado. Instale o Docker Desktop primeiro.', 'red');
    log('   https://www.docker.com/products/docker-desktop/', 'yellow');
    process.exit(1);
  }
  
  // Verificar se o banco está rodando, se não, iniciar
  logStep('1/10', 'Verificando se o banco de dados está rodando...');
  try {
    const output = execSync('docker ps --filter name=afastamentos-postgres --format "{{.Names}}"', { 
      encoding: 'utf-8',
      shell: true 
    });
    if (!output.trim().includes('afastamentos-postgres')) {
      log('   Iniciando banco de dados...', 'yellow');
      execSync('docker compose up -d', { stdio: 'inherit', shell: true });
      await wait(3000);
      log('✅ Banco de dados iniciado!', 'green');
    } else {
      log('✅ Banco de dados já está rodando!', 'green');
    }
  } catch (error) {
    log('   Iniciando banco de dados...', 'yellow');
    try {
      execSync('docker compose up -d', { stdio: 'inherit', shell: true });
      await wait(3000);
      log('✅ Banco de dados iniciado!', 'green');
    } catch (err) {
      log('❌ Erro ao iniciar banco de dados.', 'red');
      log('   Execute manualmente: docker compose up -d', 'yellow');
      process.exit(1);
    }
  }
  
  // Aguardar banco estar pronto
  logStep('2/10', 'Aguardando banco de dados ficar pronto...');
  const dbReady = await checkDatabase();
  if (!dbReady) {
    log('\n❌ Setup interrompido. Banco de dados não disponível.', 'red');
    log('   Aguarde alguns segundos e tente: npm run setup', 'yellow');
    process.exit(1);
  }
  
  // Verificar/criar .env
  const apiDir = path.join(__dirname, 'afastamentos-api');
  const envPath = path.join(apiDir, '.env');
  const expectedEnvContent = 'DATABASE_URL="postgresql://postgres:postgres123@localhost:5432/afastamentos_db"\n';
  
  if (!fs.existsSync(envPath)) {
    logStep('3/8', 'Criando arquivo .env da API...');
    fs.writeFileSync(envPath, expectedEnvContent);
    log('✅ Arquivo .env da API criado!', 'green');
  } else {
    // Verificar se o conteúdo está correto (PostgreSQL)
    const currentContent = fs.readFileSync(envPath, 'utf-8');
    if (!currentContent.includes('postgresql://') && !currentContent.includes('postgres://')) {
      logStep('3/10', 'Atualizando arquivo .env da API para PostgreSQL...');
      fs.writeFileSync(envPath, expectedEnvContent);
      log('✅ Arquivo .env da API atualizado!', 'green');
    } else {
      logStep('3/10', 'Arquivo .env da API já existe e está correto.');
    }
  }
  
  // Instalar dependências da API
  const nodeModulesApi = path.join(apiDir, 'node_modules');
  if (!fs.existsSync(nodeModulesApi)) {
    logStep('4/10', 'Instalando dependências da API...');
    process.chdir(apiDir);
    execSync('npm install', { stdio: 'inherit', shell: true });
    log('✅ Dependências da API instaladas!', 'green');
    process.chdir(__dirname);
  } else {
    logStep('4/10', 'Dependências da API já instaladas.');
  }
  
  // Configurar Prisma
  logStep('5/10', 'Configurando banco de dados (Prisma)...');
  process.chdir(apiDir);
  
  // Verificar se as migrations são do MySQL e precisam ser recriadas
  const migrationsDir = path.join(apiDir, 'prisma', 'migrations');
  const migrationLockPath = path.join(apiDir, 'prisma', 'migrations', 'migration_lock.toml');
  let needsMigrationRecreate = false;
  
  if (fs.existsSync(migrationLockPath)) {
    try {
      const lockContent = fs.readFileSync(migrationLockPath, 'utf-8');
      if (lockContent.includes('provider = "mysql"')) {
        log('   ⚠️  Migrations antigas do MySQL detectadas. Recriando para PostgreSQL...', 'yellow');
        needsMigrationRecreate = true;
      }
    } catch (err) {
      // Se não conseguir ler, assume que precisa recriar
      needsMigrationRecreate = true;
    }
  } else if (fs.existsSync(migrationsDir) && fs.readdirSync(migrationsDir).length > 0) {
    // Se não tem lock file mas tem migrations, verifica se são do MySQL
    const firstMigration = fs.readdirSync(migrationsDir)
      .filter(f => fs.statSync(path.join(migrationsDir, f)).isDirectory())
      .sort()[0];
    if (firstMigration) {
      const migrationFiles = fs.readdirSync(path.join(migrationsDir, firstMigration));
      const sqlFile = migrationFiles.find(f => f.endsWith('.sql'));
      if (sqlFile) {
        const sqlContent = fs.readFileSync(path.join(migrationsDir, firstMigration, sqlFile), 'utf-8');
        if (sqlContent.includes('AUTO_INCREMENT') || sqlContent.includes('utf8mb4') || sqlContent.includes('`')) {
          log('   ⚠️  Migrations antigas do MySQL detectadas. Recriando para PostgreSQL...', 'yellow');
          needsMigrationRecreate = true;
        }
      }
    }
  }
  
  // Se precisar recriar migrations, deletar a pasta
  if (needsMigrationRecreate && fs.existsSync(migrationsDir)) {
    log('   Removendo migrations antigas...', 'yellow');
    try {
      const migrationDirs = fs.readdirSync(migrationsDir)
        .filter(f => fs.statSync(path.join(migrationsDir, f)).isDirectory());
      migrationDirs.forEach(dir => {
        fs.rmSync(path.join(migrationsDir, dir), { recursive: true, force: true });
      });
      if (fs.existsSync(migrationLockPath)) {
        fs.unlinkSync(migrationLockPath);
      }
      log('   ✅ Migrations antigas removidas!', 'green');
    } catch (err) {
      log('   ⚠️  Aviso: Não foi possível remover migrations antigas completamente.', 'yellow');
    }
  }
  
  try {
    // Gerar Prisma Client
    execSync('npx prisma generate', { stdio: 'inherit', shell: true });
    log('✅ Prisma Client gerado!', 'green');
    
    // Aplicar ou criar migrations
    if (needsMigrationRecreate || !fs.existsSync(migrationLockPath)) {
      log('   Criando novas migrations para PostgreSQL...', 'yellow');
      try {
        execSync('npx prisma migrate dev --name init', { stdio: 'inherit', shell: true });
        log('✅ Migrations criadas e aplicadas!', 'green');
      } catch (error) {
        // Se falhar por causa de migrations antigas no banco, resetar o banco
        if (error.message.includes('failed') || error.message.includes('missing from the local migrations')) {
          log('   ⚠️  Detectadas migrations antigas no banco. Resetando banco...', 'yellow');
          log('   (Isso vai apagar todos os dados, mas é necessário para migração)', 'yellow');
          try {
            execSync('npx prisma migrate reset --force', { stdio: 'inherit', shell: true });
            log('   ✅ Banco resetado! Criando migrations novamente...', 'green');
            execSync('npx prisma migrate dev --name init', { stdio: 'inherit', shell: true });
            log('✅ Migrations criadas e aplicadas!', 'green');
          } catch (resetError) {
            throw resetError;
          }
        } else {
          throw error;
        }
      }
    } else {
      try {
        execSync('npx prisma migrate deploy', { stdio: 'inherit', shell: true });
        log('✅ Migrations aplicadas!', 'green');
      } catch (error) {
        log('   Migrations não aplicadas, tentando criar novas...', 'yellow');
        execSync('npx prisma migrate dev --name init', { stdio: 'inherit', shell: true });
        log('✅ Migrations criadas e aplicadas!', 'green');
      }
    }
  } catch (error) {
    log('❌ Erro ao configurar Prisma.', 'red');
    log(`   Detalhes: ${error.message}`, 'red');
    process.chdir(__dirname);
    process.exit(1);
  }
  
  // Rodar seed
  logStep('6/10', 'Criando usuário administrador inicial...');
  try {
    execSync('npm run prisma:seed', { stdio: 'inherit', shell: true });
    log('✅ Usuário administrador criado!', 'green');
  } catch (error) {
    log('⚠️  Aviso: Erro ao executar seed.', 'yellow');
    log('   O usuário pode já existir ou será criado na primeira execução da API.', 'yellow');
  }
  
  process.chdir(__dirname);
  
  // Verificar/criar .env do Frontend
  const webDir = path.join(__dirname, 'afastamentos-web');
  const webEnvPath = path.join(webDir, '.env');
  
  if (!fs.existsSync(webEnvPath)) {
    logStep('7/10', 'Criando arquivo .env do Frontend...');
    const webEnvContent = 'VITE_API_URL=http://localhost:3002\n';
    fs.writeFileSync(webEnvPath, webEnvContent);
    log('✅ Arquivo .env do Frontend criado!', 'green');
  } else {
    logStep('7/10', 'Arquivo .env do Frontend já existe.');
  }
  
  // Instalar dependências do Frontend
  const nodeModulesWeb = path.join(webDir, 'node_modules');
  if (!fs.existsSync(nodeModulesWeb)) {
    logStep('8/10', 'Instalando dependências do Frontend...');
    process.chdir(webDir);
    execSync('npm install', { stdio: 'inherit', shell: true });
    log('✅ Dependências do Frontend instaladas!', 'green');
    process.chdir(__dirname);
  } else {
    logStep('8/10', 'Dependências do Frontend já instaladas.');
  }

  const orionSpaDirs = ['orion-suporte-web', 'orion-qualidade-web', 'orion-patrimonio-web'];
  const spaEnvLine = 'VITE_API_URL=http://localhost:3002\n';
  logStep('9/10', 'Apps Órion (Suporte, Qualidade, Patrimônio): .env e dependências...');
  for (const dir of orionSpaDirs) {
    const spaDir = path.join(__dirname, dir);
    if (!fs.existsSync(spaDir)) {
      log(`   ⚠️  Pasta ${dir} não encontrada, ignorando.`, 'yellow');
      continue;
    }
    const spaEnvPath = path.join(spaDir, '.env');
    if (!fs.existsSync(spaEnvPath)) {
      fs.writeFileSync(spaEnvPath, spaEnvLine);
      log(`   ✅ .env criado em ${dir}`, 'green');
    }
    const spaNodeModules = path.join(spaDir, 'node_modules');
    if (!fs.existsSync(spaNodeModules)) {
      log(`   Instalando dependências de ${dir}...`, 'yellow');
      process.chdir(spaDir);
      execSync('npm install', { stdio: 'inherit', shell: true });
      process.chdir(__dirname);
      log(`   ✅ ${dir}`, 'green');
    }
  }
  logStep('10/10', 'Verificação final do banco...');
  try {
    const result = execSync('docker exec afastamentos-postgres psql -U postgres -d afastamentos_db -c "\\dt"', {
      encoding: 'utf-8',
      shell: true,
      stdio: 'pipe'
    });
    if (result.includes('Policial') || result.includes('Usuario') || result.includes('Afastamento')) {
      log('✅ Tabelas criadas com sucesso!', 'green');
    }
  } catch (error) {
    log('   ⚠️  Não foi possível verificar as tabelas, mas continuando...', 'yellow');
  }
  
  log('\n✅ Setup concluído com sucesso!\n', 'green');
  log('📋 Credenciais do usuário inicial:', 'cyan');
  log('   Matrícula: 1966901', 'green');
  log('   Senha: admin123\n', 'green');
  log('🚀 Para iniciar o projeto:', 'cyan');
  log('   Raiz: npm run start:full  → API + SAD + Órion Suporte + Órion Qualidade + Órion Patrimônio', 'yellow');
  log('   (start:full já sobe a API na 3002 — não rode start:api em outro terminal.)', 'yellow');
  log('   Se a API já estiver rodando: npm run start:full:without-api', 'yellow');
  log('   Ou separado:', 'cyan');
  log('   1. npm run start:api', 'yellow');
  log('   2. npm run start:web', 'yellow');
  log('   3. npm run start:orion-suporte  (porta 5180)', 'yellow');
  log('   4. npm run start:orion-qualidade (porta 5182)', 'yellow');
  log('   5. npm run start:orion-patrimonio (porta 5184)\n', 'yellow');
  log('   Instalar deps dos SPAs Órion: npm run install:all\n', 'yellow');
  log('🌐 URLs (dev):', 'cyan');
  log('   SAD:       http://localhost:5173', 'green');
  log('   API:       http://localhost:3002', 'green');
  log('   Suporte:   http://localhost:5180', 'green');
  log('   Qualidade:  http://localhost:5182', 'green');
  log('   Patrimônio: http://localhost:5184\n', 'green');
  log('⚠️  IMPORTANTE: Altere a senha após o primeiro login!\n', 'yellow');
}

main().catch((error) => {
  log(`\n❌ Erro no setup: ${error.message}`, 'red');
  if (error.stack) {
    log(error.stack, 'red');
  }
  process.exit(1);
});
