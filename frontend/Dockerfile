# ---- 构建层：Node 22（Next.js 16 要求 >=20）----
# 为什么选 next start 而不是 standalone：
#   standalone 需要改 next.config 并手工搬运 public/，省约 300MB 镜像体积；
#   本项目单机部署、磁盘充裕，且 next start 下 public/ 为运行时读取——
#   赞赏码可以只读挂载进容器而不进镜像（已实测验证）。换取更少的移动部件。
FROM node:22-alpine AS build
WORKDIR /build

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# NEXT_PUBLIC_* 是构建期内联变量（浏览器端代码里是字面量）：
# 换正式域名必须带新 ARG 重新 build，容器启动时改环境变量无效
ARG NEXT_PUBLIC_API_MOCK=false
ARG NEXT_PUBLIC_API_BASE_URL=
ARG NEXT_PUBLIC_ALLOW_INDEXING=false
ENV NEXT_PUBLIC_API_MOCK=$NEXT_PUBLIC_API_MOCK \
    NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL \
    NEXT_PUBLIC_ALLOW_INDEXING=$NEXT_PUBLIC_ALLOW_INDEXING

RUN npm run build

# ---- 运行层 ----
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app

COPY --from=build /build/package.json /build/package-lock.json ./
COPY --from=build /build/node_modules ./node_modules
COPY --from=build /build/.next ./.next
COPY --from=build /build/public ./public
COPY --from=build /build/next.config.ts ./

# 非 root（node 镜像内置 uid 1000 用户）
USER node
EXPOSE 3000

# alpine 自带 busybox wget，探活不引入 curl
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
    CMD wget -q -O /dev/null http://localhost:3000/ || exit 1

CMD ["npm", "run", "start"]
