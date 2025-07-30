# macOS 本地部署使用说明

## 🍎 系统要求

- **操作系统**: macOS 15.5+
- **Node.js**: 14.0+
- **MySQL**: 8.0+
- **内存**: 至少 4GB
- **磁盘空间**: 至少 1GB

## 📦 安装前准备

### 1. 安装 Homebrew（如果未安装）
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### 2. 安装 Node.js
```bash
# 方式1: 使用 Homebrew
brew install node

# 方式2: 从官网下载
# 访问 https://nodejs.org 下载最新 LTS 版本
```

### 3. 安装 MySQL
```bash
# 方式1: 使用 Homebrew
brew install mysql

# 方式2: 从官网下载
# 访问 https://dev.mysql.com/downloads/mysql/ 下载 macOS 版本
```

### 4. 启动 MySQL 服务
```bash
# 使用 Homebrew 安装的 MySQL
brew services start mysql

# 或使用系统偏好设置
# 系统偏好设置 → MySQL → Start MySQL Server

# 或使用命令行
sudo /usr/local/mysql/support-files/mysql.server start
```

### 5. 设置 MySQL root 密码（首次使用）
```bash
# 运行安全配置脚本
mysql_secure_installation

# 或手动登录设置
mysql -u root
ALTER USER 'root'@'localhost' IDENTIFIED BY '你的密码';
FLUSH PRIVILEGES;
EXIT;
```

## 🚀 快速部署

### 1. 下载项目文件
```bash
# 假设你已经有了 property-system 文件夹
cd property-system
```

### 2. 运行自动部署脚本
```bash
# 给脚本执行权限
chmod +x setup-macos.sh

# 运行部署脚本
./setup-macos.sh
```

脚本会自动完成：
- ✅ 检查系统环境
- ✅ 测试 MySQL 连接
- ✅ 安装 Node.js 依赖
- ✅ 创建数据库
- ✅ 配置环境变量
- ✅ 初始化数据表

### 3. 启动系统
```bash
# 使用生成的启动脚本
./start-macos.sh

# 或手动启动
cd backend
npm start
```

## 🔧 手动部署（如果自动脚本失败）

### 1. 安装依赖
```bash
cd backend
npm install
```

### 2. 配置环境变量
```bash
# 复制配置文件
cp .env.example .env

# 编辑配置文件
nano .env
```

编辑 `.env` 文件内容：
```env
# MySQL数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=你的MySQL密码
DB_NAME=property_management

# 服务器配置
PORT=3000
NODE_ENV=development

# 文件上传配置
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=10485760
```

### 3. 创建数据库
```bash
# 登录 MySQL
mysql -u root -p

# 创建数据库
CREATE DATABASE property_management CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;
```

### 4. 测试数据库连接
```bash
cd backend
node test-mysql.js
```

### 5. 启动服务
```bash
npm start
```

## 🌐 访问系统

### 后端 API
- **地址**: http://localhost:3000
- **健康检查**: http://localhost:3000/health
- **API 文档**: http://localhost:3000

### 前端界面
- **文件位置**: `frontend/index.html`
- **打开方式**: 直接用浏览器打开该文件

## 📱 常用功能

### 业主管理
- 添加业主信息
- 上传业主照片
- 查询业主资料

### 房产管理
- 登记房产信息
- 房产状态管理
- 租赁信息维护

### 收费管理
- 物业费收缴
- 水电费管理
- 费用统计报表

### 车辆管理
- 车辆登记
- 车位分配
- 违章记录

## 🛠 故障排除

### MySQL 连接问题
```bash
# 检查 MySQL 服务状态
brew services list | grep mysql

# 重启 MySQL 服务
brew services restart mysql

# 检查端口占用
lsof -i :3306

# 测试连接
mysql -u root -p -e "SELECT 1;"
```

### Node.js 依赖问题
```bash
# 清除 npm 缓存
npm cache clean --force

# 删除 node_modules 重新安装
rm -rf node_modules package-lock.json
npm install

# 检查 Node.js 版本
node -v
npm -v
```

### 端口占用问题
```bash
# 查看端口占用
lsof -i :3000

# 杀死占用进程
kill -9 PID号

# 或修改端口
# 编辑 .env 文件中的 PORT=3001
```

### 权限问题
```bash
# 给脚本执行权限
chmod +x *.sh

# 检查文件夹权限
ls -la

# 修改权限（如需要）
chmod 755 backend/
```

## 📝 开发模式

### 启动开发服务器
```bash
cd backend
npm run dev  # 使用 nodemon 自动重启
```

### 查看日志
```bash
# 查看实时日志
tail -f backend/server.log

# 查看错误日志
cat backend/server.log | grep ERROR
```

### 数据库管理
```bash
# 进入 MySQL 控制台
mysql -u root -p property_management

# 查看所有表
SHOW TABLES;

# 查看表结构
DESCRIBE owners;

# 查看数据
SELECT * FROM owners LIMIT 5;
```

## 🔒 安全提醒

1. **不要在生产环境使用默认密码**
2. **定期备份数据库**：
   ```bash
   mysqldump -u root -p property_management > backup.sql
   ```
3. **及时更新依赖项**：
   ```bash
   npm audit
   npm audit fix
   ```

## 📞 技术支持

如果遇到问题：

1. **检查日志文件**: `backend/server.log`
2. **查看错误信息**: 控制台输出
3. **测试数据库**: 运行 `node test-mysql.js`
4. **重新部署**: 运行 `./setup-macos.sh`

## 🎯 下一步

部署成功后，你可以：

1. **导入现有数据**: 使用 Excel 导入功能
2. **自定义配置**: 修改收费标准、房产类型等
3. **备份数据**: 设置定期数据库备份
4. **性能优化**: 根据使用情况调整配置

---

**最后更新**: $(date +"%Y-%m-%d")  
**适用版本**: macOS 15.5, Node.js 14+, MySQL 8.0+