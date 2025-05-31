#!/bin/bash
# 添加host.docker.internal到hosts文件
HOST_DOMAIN="host.docker.internal"
ping -q -c1 $HOST_DOMAIN > /dev/null 2>&1
if [ $? -ne 0 ]; then
  HOST_IP=$(ip route | awk '/default/ { print $3 }')
  echo -e "$HOST_IP\t$HOST_DOMAIN" >> /etc/hosts
fi

# 启动nginx
nginx -g "daemon off;" 