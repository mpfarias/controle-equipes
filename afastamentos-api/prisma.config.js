require('dotenv/config');
const { defineConfig, env } = require('prisma/config');

module.exports = defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    provider: 'postgresql',
    url: env('DATABASE_URL'),
  },
});
