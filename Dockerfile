FROM node:24.0-alpine3.20

ARG NODE_ENV=production
ENV NODE_ENV=$NODE_ENV

USER node

WORKDIR /opt/node_app

COPY --chown=node:node package.json package-lock.json* ./
RUN npm ci && npm cache clean --force
ENV PATH=/opt/node_app/node_modules/.bin:$PATH

WORKDIR /opt/node_app/app
COPY --chown=node:node . .
RUN npm run build
CMD [ "npm", "run", "prod" ]
