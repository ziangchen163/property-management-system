const express = require('express');
const multer = require('multer');
const path = require('path');
const {
  importOwners,
  importProperties,
  importParkingSpaces,
  getTemplate
} = require('../controllers/importController');

const router = express.Router();

// 配置multer用于文件上传
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../uploads/temp'));
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    // 只允许Excel文件
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
        file.mimetype === 'application/vnd.ms-excel' ||
        file.originalname.endsWith('.xlsx') ||
        file.originalname.endsWith('.xls')) {
      cb(null, true);
    } else {
      cb(new Error('只支持Excel文件(.xlsx, .xls)'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB限制
  }
});

// 创建临时目录
const fs = require('fs');
const tempDir = path.join(__dirname, '../uploads/temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// 导入业主数据
router.post('/owners', upload.single('file'), importOwners);

// 导入房产数据
router.post('/properties', upload.single('file'), importProperties);

// 导入车位数据
router.post('/parking', upload.single('file'), importParkingSpaces);

// 下载导入模板
router.get('/template/:type', getTemplate);

module.exports = router;