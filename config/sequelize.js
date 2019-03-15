const {
  APP_ENV,
  RDS_DB_NAME,
  RDS_HOSTNAME,
  RDS_PASSWORD,
  RDS_USERNAME,
  RDS_PORT,
} = process.env;

if (APP_ENV != 'test' && !RDS_DB_NAME) {
  throw new Error('RDS_DB_NAME not defined.');
}

const dbOptions = {
  connection: {
    name: RDS_DB_NAME,
    username: RDS_USERNAME,
    password: RDS_PASSWORD,
  },
  sequelizeOpts: {
    dialect: 'mysql',
    host: RDS_HOSTNAME,
    port: RDS_PORT || '3306',
    operatorsAliases: false,
  },
};

const settings = {
  test: {
    connection: {
      name: 'dbee',
      username: 'root',
      password: 'root',
    },
    sequelizeOpts: {
      dialect: 'sqlite',
      logging: false,
      storage: ':memory:',
      operatorsAliases: false,
    },
  },
  development: dbOptions,
  staging: dbOptions,
  production: dbOptions,
};

module.exports = settings[APP_ENV || 'development'];
