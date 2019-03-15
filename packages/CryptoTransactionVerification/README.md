# Installation

Running a local `npm install` with this package will create problems
after a `serverless deploy`, as some transitive dependencies 
need to be built [for the deployed environment](https://forum.serverless.com/t/issue-with-deploying-macos-built-node-module/2776).

A workaround is to run the installation in a 
[Docker container](https://github.com/lambci/docker-lambda)
in place of the `npm install` step, as:

    docker run --rm -v "$PWD":/var/task lambci/lambda:build-nodejs8.10

## Deployment

    serverless deploy    