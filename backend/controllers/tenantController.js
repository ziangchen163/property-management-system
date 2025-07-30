const { pool } = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 配置租客照片上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads/tenants');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = `tenant_${Date.now()}_${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
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

// 获取所有租客
const getTenants = async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT * FROM tenants 
      ORDER BY created_at DESC
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 根据ID获取租客详情
const getTenantById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const [rows] = await pool.execute('SELECT * FROM tenants WHERE id = ?', [id]);
    
    if (rows.length === 0) {
      res.status(404).json({ success: false, message: '租客不存在' });
    } else {
      res.json({
        success: true,
        data: {
          tenant: rows[0]
        }
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 创建租客
const createTenant = async (req, res) => {
  try {
    const { name, phone, id_card } = req.body;
    
    // 检查电话号码唯一性（如果提供）
    if (phone) {
      const [phoneRows] = await pool.execute('SELECT id FROM tenants WHERE phone = ?', [phone]);
      
      if (phoneRows.length > 0) {
        return res.status(400).json({ success: false, message: '电话号码已存在' });
      }
    }
    
    // 检查身份证号唯一性（如果提供）
    if (id_card) {
      const [idCardRows] = await pool.execute('SELECT id FROM tenants WHERE id_card = ?', [id_card]);
      
      if (idCardRows.length > 0) {
        return res.status(400).json({ success: false, message: '身份证号已存在' });
      }
    }
    
    const [result] = await pool.execute(
      'INSERT INTO tenants (name, phone, id_card, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
      [name, phone || null, id_card || null]
    );
    
    res.json({ success: true, data: { id: result.insertId } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 更新租客信息
const updateTenant = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, id_card } = req.body;
    
    // 检查电话号码唯一性（如果提供）
    if (phone) {
      const [phoneRows] = await pool.execute('SELECT id FROM tenants WHERE phone = ? AND id != ?', [phone, id]);
      
      if (phoneRows.length > 0) {
        return res.status(400).json({ success: false, message: '电话号码已存在' });
      }
    }
    
    // 检查身份证号唯一性（如果提供）
    if (id_card) {
      const [idCardRows] = await pool.execute('SELECT id FROM tenants WHERE id_card = ? AND id != ?', [id_card, id]);
      
      if (idCardRows.length > 0) {
        return res.status(400).json({ success: false, message: '身份证号已存在' });
      }
    }
    
    const [result] = await pool.execute(
      'UPDATE tenants SET name=?, phone=?, id_card=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
      [name, phone || null, id_card || null, id]
    );
    
    if (result.affectedRows === 0) {
      res.status(404).json({ success: false, message: '租客不存在' });
    } else {
      res.json({ success: true, message: '租客信息更新成功' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 删除租客
const deleteTenant = async (req, res) => {
  try {
    const { id } = req.params;
    
    // 检查是否有关联的租赁合同
    const [contractRows] = await pool.execute('SELECT id FROM rental_contracts WHERE tenant_id = ?', [id]);
    
    if (contractRows.length > 0) {
      return res.status(400).json({ success: false, message: '该租客存在租赁合同，无法删除' });
    }
    
    // 获取租客照片以便删除
    const [tenantRows] = await pool.execute('SELECT photo_url FROM tenants WHERE id = ?', [id]);
    
    // 删除租客记录
    const [result] = await pool.execute('DELETE FROM tenants WHERE id=?', [id]);
    
    if (result.affectedRows === 0) {
      res.status(404).json({ success: false, message: '租客不存在' });
    } else {
      // 删除照片文件
      if (tenantRows.length > 0 && tenantRows[0].photo_url) {
        const photoPath = path.join(__dirname, '..', tenantRows[0].photo_url);
        if (fs.existsSync(photoPath)) {
          fs.unlinkSync(photoPath);
        }
      }
      res.json({ success: true, message: '租客删除成功' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 上传租客照片
const uploadTenantPhoto = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: '请选择要上传的图片' });
    }
    
    const photoUrl = `/uploads/tenants/${req.file.filename}`;
    
    // 获取旧照片路径以便删除
    const [oldPhotoRows] = await pool.execute('SELECT photo_url FROM tenants WHERE id = ?', [id]);
    
    // 更新数据库中的照片路径
    const [result] = await pool.execute('UPDATE tenants SET photo_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
      [photoUrl, id]
    );
    
    // 删除旧照片文件
    if (oldPhotoRows.length > 0 && oldPhotoRows[0].photo_url) {
      const oldPhotoPath = path.join(__dirname, '..', oldPhotoRows[0].photo_url);
      if (fs.existsSync(oldPhotoPath)) {
        fs.unlinkSync(oldPhotoPath);
      }
    }
    
    res.json({ 
      success: true, 
      message: '照片上传成功',
      data: { photo_url: photoUrl }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 删除租客照片
const deleteTenantPhoto = async (req, res) => {
  try {
    const { id } = req.params;
    
    // 获取当前照片路径
    const [rows] = await pool.execute('SELECT photo_url FROM tenants WHERE id = ?', [id]);
    
    if (rows.length === 0 || !rows[0].photo_url) {
      return res.status(404).json({ success: false, message: '该租客没有照片' });
    }
    
    // 删除数据库记录
    const [result] = await pool.execute('UPDATE tenants SET photo_url = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
      [id]
    );
    
    // 删除文件
    const photoPath = path.join(__dirname, '..', rows[0].photo_url);
    if (fs.existsSync(photoPath)) {
      fs.unlinkSync(photoPath);
    }
    
    res.json({ 
      success: true, 
      message: '照片删除成功'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getTenants,
  getTenantById,
  createTenant,
  updateTenant,
  deleteTenant,
  uploadTenantPhoto,
  deleteTenantPhoto,
  upload  // 导出multer实例供路由使用
};