# 🍎 macOS 快速启动指南

## 一键部署（推荐）

```bash
# 1. 进入项目目录
cd property-system

# 2. 运行部署脚本
./setup-macos.sh

# 3. 启动系统
./start-macos.sh
```

## 访问地址

- **后端API**: http://localhost:3000
- **前端页面**: 打开 `frontend/index.html`

## 需要提前准备

1. **安装 Node.js**: https://nodejs.org
2. **安装 MySQL**: `brew install mysql`
3. **启动 MySQL**: `brew services start mysql`

## 如果遇到问题

1. 查看 `MACOS_SETUP.md` 详细说明
2. 检查 MySQL 服务是否运行
3. 确认 MySQL root 密码

---

**首次使用建议**: 按照 `MACOS_SETUP.md` 文档逐步操作