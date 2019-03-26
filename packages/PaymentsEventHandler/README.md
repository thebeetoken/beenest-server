# Installation

Running a local `npm install` with this package will create problems
after a `serverless deploy`, as some transitive dependencies 
need to be built [for the deployed environment](https://forum.serverless.com/t/issue-with-deploying-macos-built-node-module/2776).

A workaround is to run the installation in a 
[Docker container](https://github.com/lambci/docker-lambda)
in place of the `npm install` step, as:

    docker run --rm -v "$PWD":/var/task lambci/lambda:build-nodejs8.10

(For local testing, `npm install` is sufficient.)

## Deployment

    serverless deploy

## Testing

* Complete a Ropsten booking through Beenest, with BEE.
  * **Verify**: Booking ID in database shows "guest_confirmed"
* Go to /admin and approve the Booking (MetaMask will pop up)
  * **Verify**: Booking ID in database shows "host_approved"
* Run `serverless invoke local -f pollEventsDev`
  * This needs environment variables (Ropsten values shown)
    * ADMIN_SECRET=dev-events-secret
    * PAYMENTS_CONTRACT_ADDRESS=0x6bC080D7dFfacF4E04F6a0FC46DCe0c459A6C004
    * INFURA_URL=https://ropsten.infura.io/v3/(key);
  * **Verify**: Booking ID in database shows "guest_paid"
