<img alttext="COVID Green Logo" src="https://raw.githubusercontent.com/lfph/artwork/master/projects/covidgreen/stacked/color/covidgreen-stacked-color.png" width="300" />

# Exposure Notification API Service

## Local Development: Running the API and Database

The backend API consists of both a [Fastify](https://www.fastify.io/) server and a PostgreSQL database. To get these running will require the following steps. You will need Docker installed to run the database, and you may use Docker to run the API service as well.

You have two options if you want to run the API and database locally: run everything inside Docker or run just the database inside Docker. It's up to you whether you like doing it one way or the other. If the API doesn't appear to be starting correctly outside of a Docker then try running everything inside Docker - the issue might just be a local environment thing.

In either case, basic setup is necessary before anything else. Please run these commands to install dependencies and create a basic environment configuration.
​
```bash
$> npm install
$> npm run create:env
```

### Running API Outside Docker

You can run the API outside of Docker but the database still requires Docker.

First we'll start and setup the database.
```bash
$> npm run db:up
   # Postgres database is started

$> npm run db:migrate
   # Migration script is run to setup the tables and indexes
```

Next, we'll want to start the API service itself
```bash
$> npm run start:dev
[nodemon] 2.0.4
[nodemon] to restart at any time, enter `rs`
[nodemon] watching path(s): *.*
[nodemon] watching extensions: js,mjs,json
[nodemon] starting `node .`

[1596743208358] INFO  (80 on e1655c760ecf): Server listening at http://0.0.0.0:5000
[1596743208359] INFO  (80 on e1655c760ecf): Server running at: http://0.0.0.0:5000
```

At this point the API service is up and listening on port 5000. Editing files will cause `nodemon` to restart the service.

### Running API with Docker

You can also run the API with Docker as well. This is recommended if running outside of Docker fails for unexpected local environment or dependency conflicts. For example, we've seen issues running the API with Node 14.x as it's only been certified with Node 12.x.

You can start everything with one single command.
```bash
$> npm run system:up
....
Starting covid-green-db            ... done
Starting covid-green-db-migrations ... done
Starting covid-green-api           ... done
Attaching to covid-green-db, covid-green-db-migrations, covid-green-api
....
covid-green-db               | 2020-08-06 20:03:49.104 UTC [1] LOG:  database system is ready to accept connections
....
covid-green-db-migrations    | > while ! node lib/migrate.js; do sleep 1; done && npm run db:check:readiness
covid-green-db-migrations    | No migrations run for schema "public". Already at the latest one.
covid-green-db-migrations    | Migration done
covid-green-db-migrations    |
covid-green-db-migrations    | > exposure-notification-api@1.0.0 db:check:readiness /covid-green
covid-green-db-migrations    | > node lib/is-database-ready.js
covid-green-db-migrations    |
covid-green-db-migrations    | Database is Ready: Version 2
covid-green-db-migrations exited with code 0
....
covid-green-api              | > npm run db:wait:readiness && npm run start:dev
....
covid-green-api              | Database is Ready: Version 2
....
covid-green-api              | [nodemon] 2.0.4
covid-green-api              | [nodemon] to restart at any time, enter `rs`
covid-green-api              | [nodemon] watching path(s): *.*
covid-green-api              | [nodemon] watching extensions: js,mjs,json
covid-green-api              | [nodemon] starting `node .`
covid-green-api              | [1596744238998] INFO  (72 on e1655c760ecf): Server listening at http://0.0.0.0:5000
covid-green-api              | [1596744238999] INFO  (72 on e1655c760ecf): Server running at: http://0.0.0.0:5000
```

And again, at this point the API service is up and listening on port 5000. You can confirm this with `docker ps`

```bash
$> docker ps
IMAGE                                     PORTS                    NAMES
covid-green-backend-api_covid-green-api   0.0.0.0:5000->5000/tcp   covid-green-api
postgres:10.4-alpine                      0.0.0.0:5432->5432/tcp   covid-green-db
```
​
Editing files outside the container will cause `nodemon` to restart the service.

### Backend API Development
​
There are a number of handy commands you can run to help with development.
​
|Command | Action |
|---|---|
|`npm run start:dev` | Run the server in dev mode, automatically restarts on file change |
|`npm run create:env`| Create a new .env file |
|`npm test`| Run unit tests |
|`npm run test:watch`| Run backend tests in watch mode, running on changed test files |
|`npm run db:migrate`| Run database migrations. |
|`npm run db:up`| Run the database server |
|`npm run db:down`| Shutdown the database server |
|`npm run db:delete`| Delete the database server. You will need to run `db:up` and `db:migrate` again. |
|`npm run lint`| Run eslint |
|`npm run lint:fix`| Run eslint in fix mode |
|`api:start:when-ready`| Start the API only after the database is ready and migrated |
|`db:migrate:until-done`| Keep trying to migrate the database until it completes successfully |
|`db:check:readiness`| Return 0 rcode if the database is migrated and ready |
|`db:wait:readiness`| Wait until the database is migrated and ready |
|`system:up`| Start everything using docker-compose |
|`system:down`| Stop everything using docker-compose |
|`system:nuke`| Stop and delete everything using docker-compose |

### Configuration & Secrets

All the endpoints in this service use varied sets of configuration settings and secrets.

#### Non Secret Settings

| .env | AWS Property Key | Description |
| :--- | :--- | :--- |
| `AWS_REGION` | None | AWS region where we're running |
| `CONFIG_VAR_PREFIX` | None | Prefix of all configuration property and secret names |
| `NODE_ENV` | None | Some string with env name in it - Some string with 'production' in it means running in production |
| `API_HOST` | `api_host` | Name of host API is running on |
| `API_PORT` | `api_port` | Port API is listening on |
| `ENABLE_CALLBACK` | `enable_callback` | Boolean indicating whether feature is turned on |
| `ENABLE_CHECK_IN` | `enable_check_in` | Boolean indicating whether feature is turned on |
| `ENABLE_METRICS` | `enable_metrics` | Boolean indicating whether feature is turned on |
| `ENABLE_NOTICES` | `enable_self_isolation_notices` | Boolean indicating whether feature is turned on |
| `LOG_LEVEL` | `log_level` | Standard logging level setting |
| `CORS_ORIGIN` | `cors_origin` | Boolean indicating something about CORS |
| `DB_HOST` | `db_host` | Connection host for database (writing/reading) |
| `DB_READ_HOST` | `db_read_host` | Connection host for database (reading) |
| `DB_PORT` | `db_port` | Port the database is listening on |
| `DB_DATABASE` | `db_database` | Name of database to connect to |
| `DB_SSL` | `db_ssl` | Boolean indicating whether database connection should be SSL |
| `DEFAULT_REGION` | `default_region` | Default Covid region |
| `REFRESH_TOKEN_EXPIRY` | `security_refresh_token_expiry` | ?? |
| `EXPOSURE_LIMIT` | ?? | ?? |
| `CODE_LIFETIME_MINS` | `security_code_lifetime_mins` | ?? |
| `TOKEN_LIFETIME_MINS` | `security_token_lifetime_mins` | ?? |
| `UPLOAD_TOKEN_LIFETIME_MINS` | `upload_token_lifetime_mins` | ?? |
| `VERIFY_RATE_LIMIT_SECS` | `security_verify_rate_limit_secs` | ?? |
| `CALLBACK_QUEUE_URL` | `callback_url` | ?? |
| `NOTICES_QUEUE_URL` | `self_isolation_notices_url` | ?? |
| `ASSETS_BUCKET` | `s3_assets_bucket` | ?? |
| `CALLBACK_RATE_LIMIT_SECS` | `security_callback_rate_limit_secs` | # of seconds required before a user can request another callback |
| `CALLBACK_RATE_LIMIT_REQUEST_COUNT` | `security_callback_rate_limit_request_count` | # of callback requests allowed before rate limit goes into effect |
| `NOTICES_RATE_LIMIT_SECS` | `security_notices_rate_limit_secs` | # of seconds required before a user can request another notice unique key |

#### Secret Settings

| .env | AWS Secret Key | Field | Meaning
| :--- | :--- | :--- | :--- |
| `DB_USER` | `rds-read-write-create` | `username` | Database username |
| `DB_PASSWORD` | `rds-read-write-create` | `password` | Database password |
| `ENCRYPT_KEY` | `encrypt` | `key` | Key used to encrypt things |
| `JWT_SECRET` | `jwt` | `key` | ?? |\
| `DEVICE_CHECK_KEY_ID` | `device-check` | `keyId` | ?? |
| `DEVICE_CHECK_KEY` | `device-check` | `key` | ?? |
| `DEVICE_CHECK_TEAM_ID` | `device-check` | `teamId` | ?? |
| `DEVICE_CHECK_PACKAGE_NAME` | `device-check` | `apkPackageName` | ?? |
| `DEVICE_CHECK_PACKAGE_DIGEST` | `device-check` | `apkDigestSha256` | ?? |
| `DEVICE_CHECK_CERTIFICATE_DIGEST` | `device-check` | `apkCertificateDigestSha256` | ?? |
| `DEVICE_CHECK_ROOT_CA` | `device-check` | `safetyNetRootCa` | ?? |
| `DEVICE_CHECK_TIME_DIFF_THRESHOLD_MINS` | `device-check` | `timeDifferenceThresholdMins` | ?? |

## Team

### Lead Maintainers

* @colmharte - Colm Harte <colm.harte@nearform.com>
* @jasnell - James M Snell <jasnell@gmail.com>
* @aspiringarc - Gar Mac Críosta <gar.maccriosta@hse.ie>

### Core Team

* @ShaunBaker - Shaun Baker <shaun.baker@nearform.com>
* @floridemai - Paul Negrutiu <paul.negrutiu@nearform.com>
* @jackdclark - Jack Clark <jack.clark@nearform.com>
* @andreaforni - Andrea Forni <andrea.forni@nearform.com>
* @jackmurdoch - Jack Murdoch <jack.murdoch@nearform.com>

### Contributors

* @fiacc - Fiacc O'Brien Moran <fiacc.obrienmoran@nearform.com>

### Past Contributors

* @dennisgove - Dennis Gove <dgove1@bloomberg.net>
* @dharding - David J Harding <davidjasonharding@gmail.com>

## Hosted By

<a href="https://www.lfph.io"><img alttext="Linux Foundation Public Health Logo" src="https://raw.githubusercontent.com/lfph/artwork/master/lfph/stacked/color/lfph-stacked-color.svg" width="200"></a>

[Linux Foundation Public Health](https://www.lfph.io)

## Acknowledgements

<a href="https://www.hse.ie"><img alttext="HSE Ireland Logo" src="https://www.hse.ie/images/hse.jpg" width="200" /></a><a href="https://nearform.com"><img alttext="NearForm Logo" src="https://openjsf.org/wp-content/uploads/sites/84/2019/04/nearform.png" width="400" /></a>

## License

Copyright (c) 2020 HSEIreland
Copyright (c) The COVID Green Contributors

[Licensed](LICENSE) under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
