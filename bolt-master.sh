#!/bin/bash

# 多套程序部署控制脚本
# 用于统一管理多个Bolt程序栈

# 配置区域
STACKS_DIR="/root/docker/stacks"
STACKS=("bolt-stack1" "bolt-stack2" "bolt-stack3")
LOG_FILE="/root/docker/bolt-master.log"

# 日志函数
log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a $LOG_FILE
}

# 确保目录存在
ensure_dirs() {
  for stack in "${STACKS[@]}"; do
    if [ ! -d "$STACKS_DIR/$stack" ]; then
      log "创建目录: $STACKS_DIR/$stack"
      mkdir -p "$STACKS_DIR/$stack"
    fi
  done
}

# 启动单个环境
start_stack() {
  local stack=$1
  log "正在启动环境: $stack"
  
  cd "$STACKS_DIR/$stack" || { log "目录不存在: $STACKS_DIR/$stack"; return 1; }
  
  # 检查docker-compose.yml文件是否存在
  if [ ! -f "docker-compose.yml" ]; then
    log "错误: docker-compose.yml 文件不存在于 $STACKS_DIR/$stack"
    return 1
  fi
  
  # 启动服务
  docker-compose up -d
  
  # 启动GRPC监控
  if [ -f "grpc_monitor.sh" ]; then
    chmod +x grpc_monitor.sh
    nohup ./grpc_monitor.sh > /dev/null 2>&1 &
    log "已启动GRPC监控服务"
  fi
  
  log "$stack 环境启动完成"
}

# 停止单个环境
stop_stack() {
  local stack=$1
  log "正在停止环境: $stack"
  
  cd "$STACKS_DIR/$stack" || { log "目录不存在: $STACKS_DIR/$stack"; return 1; }
  
  # 检查docker-compose.yml文件是否存在
  if [ ! -f "docker-compose.yml" ]; then
    log "错误: docker-compose.yml 文件不存在于 $STACKS_DIR/$stack"
    return 1
  fi
  
  # 停止GRPC监控
  pkill -f "$STACKS_DIR/$stack/grpc_monitor.sh"
  
  # 停止服务
  docker-compose down
  
  log "$stack 环境已停止"
}

# 显示状态
show_status() {
  log "=== 环境状态汇总 ==="
  
  for stack in "${STACKS[@]}"; do
    log "检查环境: $stack"
    
    if [ -d "$STACKS_DIR/$stack" ] && [ -f "$STACKS_DIR/$stack/docker-compose.yml" ]; then
      cd "$STACKS_DIR/$stack"
      log "--- $stack 容器状态 ---"
      docker-compose ps
      
      # 检查监控脚本
      monitor_pid=$(pgrep -f "$STACKS_DIR/$stack/grpc_monitor.sh")
      if [ -n "$monitor_pid" ]; then
        log "GRPC监控服务: 运行中 (PID: $monitor_pid)"
      else
        log "GRPC监控服务: 未运行"
      fi
    else
      log "$stack 环境未配置"
    fi
    
    log ""
  done
}

# 启动所有环境
start_all() {
  log "开始启动所有环境..."
  
  for stack in "${STACKS[@]}"; do
    start_stack "$stack"
  done
  
  log "所有环境启动完成"
}

# 停止所有环境
stop_all() {
  log "开始停止所有环境..."
  
  for stack in "${STACKS[@]}"; do
    stop_stack "$stack"
  done
  
  log "所有环境已停止"
}

# 重启所有环境
restart_all() {
  log "开始重启所有环境..."
  
  stop_all
  sleep 5
  start_all
  
  log "所有环境重启完成"
}

# 重启单个环境
restart_stack() {
  local stack=$1
  log "重启环境: $stack"
  
  stop_stack "$stack"
  sleep 5
  start_stack "$stack"
  
  log "$stack 环境重启完成"
}

# 命令处理
case "$1" in
  start)
    if [ -z "$2" ]; then
      start_all
    else
      start_stack "$2"
    fi
    ;;
  stop)
    if [ -z "$2" ]; then
      stop_all
    else
      stop_stack "$2"
    fi
    ;;
  restart)
    if [ -z "$2" ]; then
      restart_all
    else
      restart_stack "$2"
    fi
    ;;
  status)
    show_status
    ;;
  *)
    echo "用法: $0 {start|stop|restart|status} [环境名称]"
    echo "示例:"
    echo "  $0 start          # 启动所有环境"
    echo "  $0 start bolt-stack1  # 启动指定环境"
    echo "  $0 stop           # 停止所有环境"
    echo "  $0 restart        # 重启所有环境"
    echo "  $0 status         # 显示所有环境状态"
    exit 1
esac

exit 0 