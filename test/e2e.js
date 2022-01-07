'use strict';

const path = require('path');
const execa = require('execa');
const yargs = require('yargs');

const appName = 'testApp';
process.env.ENV_PATH = path.resolve(__dirname, '..', appName, '.env');

const { cleanTestApp, generateTestApp } = require('./helpers/test-app-generator');
const { createStrapiInstance } = require('./helpers/strapi');

const databases = {
  postgres: {
    client: 'postgres',
    connection: {
      host: '127.0.0.1',
      port: 5432,
      database: 'strapi_test',
      username: 'strapi',
      password: 'strapi',
    },
  },
  mysql: {
    client: 'mysql',
    connection: {
      host: '127.0.0.1',
      port: 3306,
      database: 'strapi_test',
      username: 'strapi',
      password: 'strapi',
    },
  },
  sqlite: {
    client: 'sqlite',
    connection: {
      filename: './tmp/data.db',
    },
    useNullAsDefault: true,
  },
};

const runAllTests = async args => {
  // start and destroy instance once so it correctly generate env variables without concurrent instances
  await createStrapiInstance();
  await strapi.destroy();

  return execa('yarn', ['test:e2e', ...args], {
    stdio: 'inherit',
    cwd: path.resolve(__dirname, '..'),
    env: {
      FORCE_COLOR: 1,
      ENV_PATH: process.env.ENV_PATH,
    },
  });
};

const main = async (database, args) => {
  try {
    await cleanTestApp(appName);
    await generateTestApp({ appName, database });

    await runAllTests(args).catch(() => {
      process.stdout.write('Tests failed\n', () => {
        process.exit(1);
      });
    });

    process.exit(0);
  } catch (error) {
    console.error(error);
    process.stdout.write('Tests failed\n', () => {
      process.exit(1);
    });
  }
};

yargs
  .command(
    '$0',
    'run end to end tests',
    yargs => {
      yargs.option('database', {
        alias: 'db',
        describe: 'choose a database',
        choices: Object.keys(databases),
        default: 'sqlite',
      });
    },
    argv => {
      const { database, _: args } = argv;

      main(databases[database], args);
    }
  )
  .help().argv;
