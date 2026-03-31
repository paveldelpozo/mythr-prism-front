FROM node:20-alpine AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY mythr-prism-front/package.json ./mythr-prism-front/package.json

RUN pnpm install --frozen-lockfile --filter mythr-prism-front...

COPY mythr-prism-front ./mythr-prism-front

RUN pnpm --filter mythr-prism-front run build

FROM nginx:1.27-alpine AS runtime

COPY mythr-prism-front/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/mythr-prism-front/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
