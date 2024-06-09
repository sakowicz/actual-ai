FROM node:20.14-alpine3.19

ARG NODE_ENV=production
ENV NODE_ENV $NODE_ENV

RUN npm i npm@10.7 -g

USER node

WORKDIR /opt/node_app

COPY --chown=node:node package.json package-lock.json* ./
RUN npm ci && npm cache clean --force
ENV PATH /opt/node_app/node_modules/.bin:$PATH

WORKDIR /opt/node_app/app
COPY --chown=node:node . .

CMD [ "node", "./bin/app" ]
