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
  logStep('1/6', 'Aguardando banco de dados ficar pronto...');
  
  for (let i = 0; i < maxAttempts; i++) {
    try {
      // Verifica se o container está rodando e saudável
      const output = execSync(
        'docker exec afastamentos-mysql mysqladmin ping -h localhost --silent',
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
  logStep('1/6', 'Verificando se o banco de dados está rodando...');
  try {
    const output = execSync('docker ps --filter name=afastamentos-mysql --format "{{.Names}}"', { 
      encoding: 'utf-8',
      shell: true 
    });
    if (!output.trim().includes('afastamentos-mysql')) {
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
  const dbReady = await checkDatabase();
  if (!dbReady) {
    log('\n❌ Setup interrompido. Banco de dados não disponível.', 'red');
    log('   Aguarde alguns segundos e tente: npm run setup', 'yellow');
    process.exit(1);
  }
  
  // Verificar/criar .env
  const apiDir = path.join(__dirname, 'afastamentos-api');
  const envPath = path.join(apiDir, '.env');
  
  if (!fs.existsSync(envPath)) {
    logStep('2/6', 'Criando arquivo .env...');
    const envContent = 'DATABASE_URL="mysql://root:root123@localhost:3306/afastamentos_db"\n';
    fs.writeFileSync(envPath, envContent);
    log('✅ Arquivo .env criado!', 'green');
  } else {
    logStep('2/6', 'Arquivo .env já existe.');
  }
  
  // Instalar dependências da API
  const nodeModulesApi = path.join(apiDir, 'node_modules');
  if (!fs.existsSync(nodeModulesApi)) {
    logStep('3/6', 'Instalando dependências da API...');
    process.chdir(apiDir);
    execSync('npm install', { stdio: 'inherit', shell: true });
    log('✅ Dependências da API instaladas!', 'green');
    process.chdir(__dirname);
  } else {
    logStep('3/6', 'Dependências da API já instaladas.');
  }
  
  // Configurar Prisma
  logStep('4/6', 'Configurando banco de dados (Prisma)...');
  process.chdir(apiDir);
  try {
    execSync('npx prisma generate', { stdio: 'inherit', shell: true });
    log('✅ Prisma Client gerado!', 'green');
    
    try {
      execSync('npx prisma migrate deploy', { stdio: 'inherit', shell: true });
      log('✅ Migrations aplicadas!', 'green');
    } catch (error) {
      log('   Tentando com migrate dev...', 'yellow');
      execSync('npx prisma migrate dev --name init', { stdio: 'inherit', shell: true });
      log('✅ Migrations aplicadas!', 'green');
    }
  } catch (error) {
    log('❌ Erro ao configurar Prisma.', 'red');
    process.chdir(__dirname);
    process.exit(1);
  }
  
  // Rodar seed
  logStep('5/6', 'Criando usuário inicial...');
  try {
    execSync('npm run prisma:seed', { stdio: 'inherit', shell: true });
  } catch (error) {
    log('⚠️  Aviso: Erro ao executar seed (usuário pode já existir).', 'yellow');
  }
  
  process.chdir(__dirname);
  
  // Instalar dependências do Frontend
  const webDir = path.join(__dirname, 'afastamentos-web');
  const nodeModulesWeb = path.join(webDir, 'node_modules');
  if (!fs.existsSync(nodeModulesWeb)) {
    logStep('6/6', 'Instalando dependências do Frontend...');
    process.chdir(webDir);
    execSync('npm install', { stdio: 'inherit', shell: true });
    log('✅ Dependências do Frontend instaladas!', 'green');
    process.chdir(__dirname);
  } else {
    logStep('6/6', 'Dependências do Frontend já instaladas.');
  }
  
  log('\n✅ Setup concluído com sucesso!\n', 'green');
  log('📋 Credenciais do usuário inicial:', 'cyan');
  log('   Matrícula: ADMIN', 'green');
  log('   Senha: admin123\n', 'green');
  log('🚀 Para iniciar o projeto:', 'cyan');
  log('   1. Terminal 1 - API:  npm run start:api', 'yellow');
  log('   2. Terminal 2 - Web:  npm run start:web\n', 'yellow');
  log('   Ou execute ambos manualmente:', 'cyan');
  log('   - cd afastamentos-api && npm run start:dev', 'yellow');
  log('   - cd afastamentos-web && npm run dev\n', 'yellow');
  log('🌐 URLs:', 'cyan');
  log('   Frontend: http://localhost:5173', 'green');
  log('   API:      http://localhost:3002\n', 'green');
  log('⚠️  IMPORTANTE: Altere a senha após o primeiro login!\n', 'yellow');
}

main().catch((error) => {
  log(`\n❌ Erro no setup: ${error.message}`, 'red');
  if (error.stack) {
    log(error.stack, 'red');
  }
  process.exit(1);
});
