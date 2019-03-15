# Listing Calendar Updates

This scheduled event runs every 10 minutes and update ical links for
listings.

## Install

``npm i -g serverless``
``npm i``

## Test Locally

```
SLS_DEBUG=* serverless invoke local --function updateListingCalendarsStaging
```

## Deploy

``serverless deploy``
