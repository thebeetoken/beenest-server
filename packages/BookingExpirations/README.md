# Booking Expirations

This scheduled event runs every 10 minutes and expires bookings.

## Install

``npm i -g serverless``
``npm i``

## Test Locally

```
SLS_DEBUG=* serverless invoke local --function expireBookingsDev
```

## Deploy

``serverless deploy``
