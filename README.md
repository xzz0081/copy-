# boltnew 项目说明

## 项目简介

本项目为一站式量化交易平台，包含前端、后端API、Redis缓存、私有镜像仓库等服务。支持一键部署，适合个人或团队快速搭建自己的量化服务环境。

---

## 目录结构

```
├── backend/         # 后端API服务
├── frontend/        # 前端静态页面
├── config/          # 配置文件
├── data/            # 数据文件（如auth_config.json等）
├── registry/        # 私有镜像仓库
├── Dockerfile       # 一体化部署镜像
├── supervisord.conf # 进程管理配置
├── nginx.conf       # nginx配置
└── README.md        # 项目说明
```

---

## 环境要求

- Docker 20+
- 推荐系统：Debian/Ubuntu/CentOS
- 服务器内存建议2G以上

---

## 一键部署方法

1. **构建镜像**
   ```bash
   docker build -t boltnew-all-in-one .
   ```

2. **启动容器**
   ```bash
   docker run -d --name boltnew \
     -p 80:80 -p 3000:3000 -p 3333:3333 -p 8080:8080 -p 8081:8081 -p 6379:6379 \
     -v /opt/boltnew-data/config:/app/config \
     -v /opt/boltnew-data/data:/app/data \
     --restart unless-stopped \
     boltnew-all-in-one
   ```

3. **访问服务**
   - 前端页面：http://服务器IP/
   - 后端API：http://服务器IP:3000/
   - Redis服务：服务器IP:6379

---

## API使用说明

### 1. 登录接口

- **地址**：`POST /api/auth/login`
- **参数**：
  ```json
  {
    "username": "你的用户名",
    "password": "你的密码",
    "totp_code": "动态验证码(如有)"
  }
  ```
- **返回**：
  ```json
  {
    "code": 0,
    "msg": "登录成功",
    "token": "xxxxxx"
  }
  ```

### 2. 获取系统状态

- **地址**：`GET /api/system-status`
- **返回**：
  ```json
  {
    "status": "ok",
    "services": {...}
  }
  ```

### 3. 其它API
- 具体接口请参考`backend`目录下的接口文档或源码注释。

---

## 常见问题

1. **502 Bad Gateway？**
   - 检查后端API服务是否正常启动，配置文件（如auth_config.json）格式是否正确。

2. **登录失败？**
   - 检查用户名、密码、动态码是否正确，或查看后端日志排查原因。

3. **如何修改配置？**
   - 编辑`/app/data/auth_config.json`等配置文件，修改后重启容器。

---

## 贡献与反馈

如有问题或建议，欢迎提issue或联系作者。

---

## License

MIT

---

**作者：@handouT00T** 