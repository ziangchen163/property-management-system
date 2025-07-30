const { pool } = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 配置车辆照片上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads/vehicles');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = `vehicle_${Date.now()}_${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
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

// 获取所有车辆
const getVehicles = async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT v.*, o.name as owner_name 
      FROM vehicles v
      LEFT JOIN owners o ON v.owner_id = o.id
      ORDER BY v.created_at DESC
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 根据ID获取车辆详情
const getVehicleById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const [rows] = await pool.execute(`
      SELECT v.*, o.name as owner_name 
      FROM vehicles v
      LEFT JOIN owners o ON v.owner_id = o.id
      WHERE v.id = ?
    `, [id]);
    
    if (rows.length === 0) {
      res.status(404).json({ success: false, message: '车辆不存在' });
    } else {
      res.json({
        success: true,
        data: {
          vehicle: rows[0]
        }
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 创建车辆
const createVehicle = async (req, res) => {
  try {
    const { license_plate, car_model, owner_id } = req.body;
    
    // 检查车牌号唯一性
    const [plateRows] = await pool.execute('SELECT id FROM vehicles WHERE license_plate = ?', [license_plate]);
    
    if (plateRows.length > 0) {
      return res.status(400).json({ success: false, message: '车牌号已存在' });
    }
    
    const [result] = await pool.execute(
      'INSERT INTO vehicles (license_plate, car_model, owner_id, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
      [license_plate, car_model || null, owner_id || null]
    );
    
    res.json({ success: true, data: { id: result.insertId } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 更新车辆信息
const updateVehicle = async (req, res) => {
  try {
    const { id } = req.params;
    const { license_plate, car_model, owner_id } = req.body;
    
    // 检查车牌号唯一性
    const [plateRows] = await pool.execute('SELECT id FROM vehicles WHERE license_plate = ? AND id != ?', [license_plate, id]);
    
    if (plateRows.length > 0) {
      return res.status(400).json({ success: false, message: '车牌号已存在' });
    }
    
    const [result] = await pool.execute(
      'UPDATE vehicles SET license_plate=?, car_model=?, owner_id=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
      [license_plate, car_model || null, owner_id || null, id]
    );
    
    if (result.affectedRows === 0) {
      res.status(404).json({ success: false, message: '车辆不存在' });
    } else {
      res.json({ success: true, message: '车辆信息更新成功' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 删除车辆
const deleteVehicle = async (req, res) => {
  try {
    const { id } = req.params;
    
    // 获取车辆照片以便删除
    const [vehicleRows] = await pool.execute('SELECT photos FROM vehicles WHERE id = ?', [id]);
    
    // 删除车辆记录
    const [result] = await pool.execute('DELETE FROM vehicles WHERE id=?', [id]);
    
    if (result.affectedRows === 0) {
      res.status(404).json({ success: false, message: '车辆不存在' });
    } else {
      // 删除照片文件
      if (vehicleRows.length > 0 && vehicleRows[0].photos) {
        try {
          const photos = JSON.parse(vehicleRows[0].photos);
          photos.forEach(photoUrl => {
            const photoPath = path.join(__dirname, '..', photoUrl);
            if (fs.existsSync(photoPath)) {
              fs.unlinkSync(photoPath);
            }
          });
        } catch (e) {
          // 忽略JSON解析错误
        }
      }
      res.json({ success: true, message: '车辆删除成功' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 上传车辆照片
const uploadVehiclePhoto = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: '请选择要上传的图片' });
    }
    
    const photoUrl = `/uploads/vehicles/${req.file.filename}`;
    
    // 获取现有照片列表
    const [rows] = await pool.execute('SELECT photos FROM vehicles WHERE id = ?', [id]);
    
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
    const [result] = await pool.execute('UPDATE vehicles SET photos = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
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

// 删除车辆照片
const deleteVehiclePhoto = async (req, res) => {
  try {
    const { id } = req.params;
    const { photo_url } = req.body;
    
    if (!photo_url) {
      return res.status(400).json({ success: false, message: '请提供要删除的照片URL' });
    }
    
    // 获取现有照片列表
    const [rows] = await pool.execute('SELECT photos FROM vehicles WHERE id = ?', [id]);
    
    if (rows.length === 0 || !rows[0].photos) {
      return res.status(404).json({ success: false, message: '该车辆没有照片' });
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
    const [result] = await pool.execute('UPDATE vehicles SET photos = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
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

module.exports = {
  getVehicles,
  getVehicleById,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  uploadVehiclePhoto,
  deleteVehiclePhoto,
  upload  // 导出multer实例供路由使用
};