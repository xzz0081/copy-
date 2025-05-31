FROM node:20-alpine AS builder

WORKDIR /app

# 复制package.json和package-lock.json
COPY package*.json ./

# 安装依赖
RUN npm ci

# 复制所有源代码进行构建
COPY . .

# 构建应用
RUN npm run build

# 生产阶段使用轻量级nginx镜像
FROM nginx:alpine

# 只复制构建产物到nginx目录
COPY --from=builder /app/dist /usr/share/nginx/html

# 复制自定义nginx配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 添加对host.docker.internal的支持
RUN apk --no-cache add bash

# 复制启动脚本
COPY entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 3535

CMD ["/docker-entrypoint.sh"] 