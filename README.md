# Beenest Backend
This is the API server for the beenest app.

## Dir Structure

| Name | Description |
| ------------------------ | --------------------------------------------------------------------------------------------- |
| **src/middlewares**      | Express middleware: logging, error handling etc.                                              |
| **src/services**         | Communications with other services: 3rd party services, payment services, image uploading,    |
| **src/controllers**      | Controllers define functions that respond to various http requests                            |
| **src/models**           | Models storing and retrieving data from DB   |
| **src**/server.js        | Entry point to your express app                                                               |

## Environments

Most configuration of Beenest is done via environment variables defined in a
[`.env` file](https://github.com/thebeetoken/beenest-env/blob/master/dev/.env).
(The linked file is appropriate for development; other versions will be appropriate
for different deployments.)

We use two additional variables to define environments:

**NODE_ENV**
This lets node know which environment to compile/run in.

* `development` - when ``APP_ENV == development || test``
* `production` - when ``APP_ENV == testnet || staging || production``

**APP_ENV**
We use a separate variable to specify our app-specific settings like
database connections.

This can be:
* `development` - running on your local machine
* `testnet` - https://api-testnet.beetoken.com
* `test` - running unit and functional tests
* `staging` - https://api-staging.beetoken.com
* `production` - https://api.beetoken.com

## Development Setup

1. Option A
Install Node and npm.

```
npm i
npm run dev
```

2. Option B

```
docker-compose up
```

## Test

```
npm test
```

## Deploy

### master
``git push master`` will deploy to staging: https://api-staging.beetoken.com/ and https://api-testnet.beetoken.com/

https://us-west-2.console.aws.amazon.com/codepipeline/home?region=us-west-2#/view/beenest-backend-master-pipeline

### production

``git checkout production && git merge master && git push`` will deploy to production: http://beenest-backend-production.us-west-2.elasticbeanstalk.com | https://api.beetoken.com/

https://us-west-2.console.aws.amazon.com/codepipeline/home?region=us-west-2#/view/beenest-backend-production-pipeline

