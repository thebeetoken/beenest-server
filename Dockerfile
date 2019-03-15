FROM node:8.10

ENV PORT 3000
ENV PATH $PATH:/app/node_modules/.bin

WORKDIR /app
COPY . /app

RUN npm i

CMD ["npm", "run", "dev"]

EXPOSE 3000

