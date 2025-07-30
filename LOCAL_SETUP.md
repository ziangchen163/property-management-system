# 物业管理系统 - 本地部署指南

## 📦 包含内容
- 完整的物业管理系统源代码
- 前端界面 (HTML/CSS/JavaScript)
- 后端API (Node.js + Express)
- SQLite数据库 (自动创建)
- 测试脚本和启动脚本

## 🚀 快速开始

### 1. 解压文件
```bash
tar -xzf property-system.tar.gz
cd property-system
```

### 2. 安装依赖
```bash
cd backend
npm install
```

### 3. 启动后端服务
```bash
# 方法1: 直接启动
node app.js

# 方法2: 后台运行
nohup node app.js > ../server.log 2>&1 &
```

### 4. 访问系统
打开浏览器访问：`file:///path/to/property-system/start-frontend.html`

或直接打开：`frontend/index.html` (确保后端已启动)

## 📋 系统功能

### ✅ 已实现功能
1. **业主管理** - 完整业主信息管理，包含搜索功能
2. **房产管理** - 房产信息登记和管理
3. **车位管理** - 车位信息和状态管理
4. **收费管理** - 费用记录和统计
5. **数据统计** - 仪表盘实时统计
6. **小区管理** - 小区基础信息

### 🏗️ 数据库结构
- `owners` - 业主信息 (姓名、电话、身份证、公司、职务、爱好、备注)
- `properties` - 房产信息 (楼栋、单元、房号、面积、业主关联)
- `parking_spaces` - 车位信息 (编号、类型、状态、业主关联)
- `communities` - 小区信息 (名称、地址)
- `fee_records` - 收费记录 (金额、状态、周期)
- 其他支持表 (vehicles, tenants, rental_contracts, decoration_permits等)

## 🧪 测试方法

### 自动化测试
```bash
# 确保后端已启动
./test-system.sh
```

### 手动测试
1. **测试API端点**:
   ```bash
   curl http://localhost:3000/api/owners
   curl http://localhost:3000/api/properties
   curl http://localhost:3000/api/parking
   curl http://localhost:3000/api/communities
   ```

2. **测试添加数据**:
   ```bash
   # 添加业主
   curl -X POST http://localhost:3000/api/owners \
     -H "Content-Type: application/json" \
     -d '{"name":"测试用户","phone":"13999999999","company":"测试公司"}'
   
   # 添加车位
   curl -X POST http://localhost:3000/api/parking \
     -H "Content-Type: application/json" \
     -d '{"community_id":1,"space_number":"TEST-001","type":"地下","status":"自用"}'
   ```

3. **前端界面测试**:
   - 访问仪表盘查看统计数据
   - 测试添加业主功能
   - 测试车位管理功能
   - 测试搜索功能

## 📁 目录结构
```
property-system/
├── backend/                 # 后端代码
│   ├── app.js              # 主应用文件
│   ├── config/             # 配置文件
│   │   └── database.js     # 数据库配置和初始化
│   ├── controllers/        # 控制器
│   ├── routes/             # 路由文件
│   └── package.json        # 依赖配置
├── frontend/               # 前端代码
│   └── index.html         # 主界面
├── database/              # 数据库文件 (自动创建)
├── start-frontend.html    # 启动页面
├── test-system.sh        # 测试脚本
└── README.md             # 本文档
```

## 🔧 技术栈
- **后端**: Node.js + Express.js + SQLite
- **前端**: HTML5 + CSS3 + JavaScript (原生)
- **数据库**: SQLite (无需额外安装)

## 📊 默认数据
系统初始化时会自动创建：
- 2个示例小区 (阳光花园、绿城小区)
- 2个示例业主 (张三、李四)
- 4个示例房产
- 4个示例车位
- 基础收费项目配置

## 🐛 故障排除

### 端口占用
如果3000端口被占用，修改 `backend/app.js` 中的端口号：
```javascript
const PORT = process.env.PORT || 3001; // 改为其他端口
```

### 数据库问题
删除 `database/property.db` 文件，重启服务会自动重新创建

### CORS问题
如果遇到跨域问题，确保后端CORS设置正确，或使用本地服务器访问前端

## 📞 支持
如有问题，请检查：
1. Node.js版本 (建议 v14+)
2. 后端服务是否正常启动
3. 数据库文件是否正确创建
4. 浏览器控制台是否有错误信息

---
系统由 Claude 开发完成 🤖