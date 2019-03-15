# ImageResizer

## Development

```
npm i
serverless offline
```

Visit http://localhost:3000/scale?url=...&w=150&h=150


## Deploy

Install linux version of sharp before deploying:

```
docker run -v "$PWD":/var/task lambci/lambda:build-nodejs8.10 npm install sharp
serverless deploy
```
