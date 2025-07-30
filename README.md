# 物业管理系统

一个基于Node.js + Express + MySQL的智能物业管理系统，支持业主管理、房产管理、收费管理、车辆管理等功能。

## 🚀 快速开始

### 前置要求
- Node.js (>= 14.0)
- MySQL (>= 8.0)
- npm 或 yarn

### 1. 安装依赖
```bash
cd backend
npm install
```

### 2. 配置MySQL数据库
```bash
# 运行MySQL配置脚本
./setup-mysql.sh

# 或手动配置：
# 1. 创建数据库
mysql -u root -p < database/mysql_schema.sql

# 2. 配置环境变量
cp backend/.env.example backend/.env
# 编辑.env文件，设置MySQL密码
```

### 3. 测试数据库连接
```bash
cd backend
node test-mysql.js
```

### 4. 启动系统
```bash
cd backend
npm start
```

### 5. 访问系统
- 后端API: http://localhost:3000
- 前端界面: 打开 frontend/index.html

## 📁 目录结构
```
property-system/
├── backend/                 # 后端API服务
│   ├── config/             # 数据库配置
│   ├── controllers/        # 控制器
│   ├── routes/            # 路由定义
│   ├── package.json       # 依赖配置
│   ├── app.js            # 应用入口
│   ├── test-mysql.js     # 数据库测试
│   └── .env.example      # 环境变量模板
├── frontend/              # 前端界面
│   └── index.html        # 主页面
├── database/             # 数据库相关
│   └── mysql_schema.sql  # MySQL数据库结构
├── setup-mysql.sh       # MySQL配置脚本
└── README.md            # 说明文档
```

## ✨ 功能特性

### 已实现功能
- ✅ 业主信息管理
- ✅ 房产信息管理
- ✅ 收费记录管理
- ✅ 装修申请管理
- ✅ 车辆信息管理
- ✅ 停车位管理
- ✅ 租赁合同管理
- ✅ 数据导入导出

### 开发中功能
- 🚧 移动端界面
- 🚧 报表统计
- 🚧 消息通知

## 🛠 技术栈

### 后端
- **Node.js** - JavaScript运行环境
- **Express.js** - Web框架
- **MySQL2** - MySQL数据库驱动
- **Multer** - 文件上传中间件
- **XLSX** - Excel文件处理

### 前端
- **HTML/CSS/JavaScript** - 基础技术
- **原生JavaScript** - 交互逻辑

### 数据库
- **MySQL 8.0** - 关系型数据库
- **InnoDB** - 存储引擎

## 📊 数据库设计

系统包含以下主要数据表：
- `communities` - 小区信息
- `owners` - 业主信息
- `properties` - 房产信息
- `parking_spaces` - 停车位信息
- `tenants` - 租客信息
- `vehicles` - 车辆信息
- `fee_records` - 收费记录
- `rental_contracts` - 租赁合同
- `decoration_permits` - 装修许可

## 🔧 API接口

### 业主管理
- `GET /api/owners` - 获取业主列表
- `POST /api/owners` - 创建业主
- `PUT /api/owners/:id` - 更新业主信息
- `DELETE /api/owners/:id` - 删除业主

### 房产管理
- `GET /api/properties` - 获取房产列表
- `POST /api/properties` - 创建房产
- `PUT /api/properties/:id` - 更新房产信息

### 收费管理
- `GET /api/fees` - 获取收费记录
- `POST /api/fees` - 创建收费记录

## 🐳 Docker部署

使用Docker Compose一键部署：
```bash
# 构建并启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 停止服务
docker-compose down
```

## 🔧 环境配置

### 环境变量说明
```bash
# MySQL数据库配置
DB_HOST=localhost          # 数据库主机
DB_PORT=3306              # 数据库端口
DB_USER=root              # 数据库用户名
DB_PASSWORD=your_password # 数据库密码
DB_NAME=property_management # 数据库名称

# 服务器配置
PORT=3000                 # 服务器端口
NODE_ENV=development      # 运行环境

# 文件上传配置
UPLOAD_PATH=./uploads     # 文件上传路径
MAX_FILE_SIZE=10485760    # 最大文件大小(10MB)
```

## 🚨 故障排除

### 常见问题

1. **数据库连接失败**
   ```bash
   # 检查MySQL服务状态
   sudo systemctl status mysql
   
   # 启动MySQL服务
   sudo systemctl start mysql
   
   # 测试连接
   node backend/test-mysql.js
   ```

2. **依赖安装失败**
   ```bash
   # 清除缓存重新安装
   npm cache clean --force
   rm -rf node_modules
   npm install
   ```

3. **端口占用**
   ```bash
   # 查看端口占用
   lsof -i :3000
   
   # 修改端口
   # 编辑 .env 文件中的 PORT 配置
   ```

## 📝 更新日志

### v1.0.0 (2024-01-01)
- ✅ 完成MySQL数据库迁移
- ✅ 实现基础业主管理功能
- ✅ 添加房产信息管理
- ✅ 支持收费记录管理

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交变更 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。
