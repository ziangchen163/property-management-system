const { pool } = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 配置车位照片上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads/parking');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = `parking_${Date.now()}_${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB限制
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('只允许上传图片文件 (JPEG, JPG, PNG, GIF)'));
    }
  }
});

// 获取所有车位
const getParkingSpaces = async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT ps.*, c.name as community_name, o.name as owner_name,
             CASE 
               WHEN o.id IS NOT NULL THEN (
                 SELECT COUNT(*) 
                 FROM properties p 
                 WHERE p.owner_id = o.id AND p.is_delivered = 0
               ) ELSE 0 
             END as undelivered_properties
      FROM parking_spaces ps
      LEFT JOIN communities c ON ps.community_id = c.id
      LEFT JOIN owners o ON ps.owner_id = o.id
      WHERE ps.is_active = 1
      ORDER BY c.name, ps.space_number
    `);
    
    // 自动更新车位状态为未交房（如果业主有未交房的房产）
    const updatedRows = await Promise.all(rows.map(async (row) => {
      if (row.undelivered_properties > 0 && row.status !== '未交房') {
        // 异步更新数据库中的状态
        await pool.execute('UPDATE parking_spaces SET status = "未交房" WHERE id = ?', [row.id]);
        row.status = '未交房';
      }
      delete row.undelivered_properties; // 移除临时字段
      return row;
    }));
    
    res.json({ success: true, data: updatedRows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 根据ID获取车位详情
const getParkingSpaceById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const [rows] = await pool.execute(`
      SELECT ps.*, c.name as community_name, o.name as owner_name
      FROM parking_spaces ps
      LEFT JOIN communities c ON ps.community_id = c.id
      LEFT JOIN owners o ON ps.owner_id = o.id
      WHERE ps.id = ?
    `, [id]);
    
    if (rows.length === 0) {
      res.status(404).json({ success: false, message: '车位不存在' });
    } else {
      res.json({
        success: true,
        data: {
          parking: rows[0]
        }
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 创建车位
const createParkingSpace = async (req, res) => {
  try {
    const { community_id, space_number, type, status, owner_id } = req.body;
    
    const [result] = await pool.execute(
      'INSERT INTO parking_spaces (community_id, space_number, type, status, owner_id, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)',
      [community_id, space_number, type || '地下', status || '自用', owner_id || null]
    );
    
    res.json({ success: true, data: { id: result.insertId } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 更新车位信息
const updateParkingSpace = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      community_id, 
      space_number, 
      type, 
      status, 
      owner_id, 
      location_description, 
      rental_price, 
      remark 
    } = req.body;
    
    const [result] = await pool.execute(
      `UPDATE parking_spaces SET 
       community_id=?, space_number=?, type=?, status=?, owner_id=?, 
       location_description=?, rental_price=?, updated_at=CURRENT_TIMESTAMP 
       WHERE id=?`,
      [
        community_id, 
        space_number, 
        type, 
        status, 
        owner_id || null, 
        location_description || null, 
        rental_price || null, 
        id
      ]
    );
    
    if (result.affectedRows === 0) {
      res.status(404).json({ success: false, message: '车位不存在' });
    } else {
      res.json({ success: true, message: '车位信息更新成功' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 停用车位
const deactivateParkingSpace = async (req, res) => {
  try {
    const { id } = req.params;
    
    const [result] = await pool.execute(
      'UPDATE parking_spaces SET is_active=0, updated_at=CURRENT_TIMESTAMP WHERE id=?',
      [id]
    );
    
    if (result.affectedRows === 0) {
      res.status(404).json({ success: false, message: '车位不存在' });
    } else {
      res.json({ success: true, message: '车位已停用' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 删除车位
const deleteParkingSpace = async (req, res) => {
  try {
    const { id } = req.params;
    
    // 检查车位是否存在
    const [parkingRows] = await pool.execute('SELECT * FROM parking_spaces WHERE id = ?', [id]);
    if (parkingRows.length === 0) {
      return res.status(404).json({ success: false, message: '车位不存在' });
    }
    
    // 检查是否有关联的收费记录
    const [feeRows] = await pool.execute('SELECT COUNT(*) as count FROM fee_records WHERE parking_space_id = ?', [id]);
    
    // 检查是否有关联的租赁合同
    const [contractRows] = await pool.execute('SELECT COUNT(*) as count FROM rental_contracts WHERE parking_space_id = ?', [id]);
    
    // 检查是否有关联的车辆绑定
    const [vehicleRows] = await pool.execute('SELECT COUNT(*) as count FROM parking_vehicle_bindings WHERE parking_space_id = ?', [id]);
    
    if (feeRows[0].count > 0 || contractRows[0].count > 0 || vehicleRows[0].count > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `无法删除车位，该车位关联了${feeRows[0].count}条收费记录、${contractRows[0].count}个租赁合同和${vehicleRows[0].count}个车辆绑定` 
      });
    }
    
    // 删除车位记录
    const [result] = await pool.execute('DELETE FROM parking_spaces WHERE id = ?', [id]);
    res.json({ success: true, message: '车位删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 上传车位照片
const uploadParkingPhoto = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: '请选择要上传的图片' });
    }
    
    const photoUrl = `/uploads/parking/${req.file.filename}`;
    
    // 获取现有照片列表
    const [rows] = await pool.execute('SELECT photos FROM parking_spaces WHERE id = ?', [id]);
    
    let photos = [];
    if (rows.length > 0 && rows[0].photos) {
      try {
        photos = JSON.parse(rows[0].photos);
      } catch (e) {
        photos = [];
      }
    }
    
    // 添加新照片
    photos.push(photoUrl);
    
    // 更新数据库
    const [result] = await pool.execute('UPDATE parking_spaces SET photos = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
      [JSON.stringify(photos), id]
    );
    
    res.json({ 
      success: true, 
      message: '照片上传成功',
      data: { photo_url: photoUrl, photos: photos }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 删除车位照片
const deleteParkingPhoto = async (req, res) => {
  try {
    const { id } = req.params;
    const { photo_url } = req.body;
    
    if (!photo_url) {
      return res.status(400).json({ success: false, message: '请提供要删除的照片URL' });
    }
    
    // 获取现有照片列表
    const [rows] = await pool.execute('SELECT photos FROM parking_spaces WHERE id = ?', [id]);
    
    if (rows.length === 0 || !rows[0].photos) {
      return res.status(404).json({ success: false, message: '该车位没有照片' });
    }
    
    let photos = [];
    try {
      photos = JSON.parse(rows[0].photos);
    } catch (e) {
      return res.status(500).json({ success: false, message: '照片数据格式错误' });
    }
    
    // 从列表中移除照片
    const updatedPhotos = photos.filter(photo => photo !== photo_url);
    
    // 更新数据库
    const [result] = await pool.execute('UPDATE parking_spaces SET photos = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
      [JSON.stringify(updatedPhotos), id]
    );
    
    // 删除文件
    const photoPath = path.join(__dirname, '..', photo_url);
    if (fs.existsSync(photoPath)) {
      fs.unlinkSync(photoPath);
    }
    
    res.json({ 
      success: true, 
      message: '照片删除成功',
      data: { photos: updatedPhotos }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 获取可出租车位
const getAvailableForRent = async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT ps.*, c.name as community_name, o.name as owner_name
      FROM parking_spaces ps
      LEFT JOIN communities c ON ps.community_id = c.id
      LEFT JOIN owners o ON ps.owner_id = o.id
      WHERE ps.status = '待出租' AND ps.is_active = 1
      ORDER BY c.name, ps.space_number
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { 
  getParkingSpaces, 
  getParkingSpaceById,
  createParkingSpace, 
  updateParkingSpace, 
  deleteParkingSpace,
  deactivateParkingSpace,
  getAvailableForRent,
  uploadParkingPhoto,
  deleteParkingPhoto,
  upload  // 导出multer实例供路由使用
};