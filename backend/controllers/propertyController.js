const { pool } = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 配置房产照片上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads/properties');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = `property_${Date.now()}_${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
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

// 获取所有房产
const getProperties = async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT p.*, o.name as owner_name, c.name as community_name
      FROM properties p 
      LEFT JOIN owners o ON p.owner_id = o.id 
      LEFT JOIN communities c ON p.community_id = c.id
      ORDER BY c.name, p.building, p.unit, p.room
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 根据ID获取房产详情
const getPropertyById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const [rows] = await pool.execute(`
      SELECT p.*, o.name as owner_name, c.name as community_name
      FROM properties p 
      LEFT JOIN owners o ON p.owner_id = o.id 
      LEFT JOIN communities c ON p.community_id = c.id
      WHERE p.id = ?
    `, [id]);
    
    if (rows.length === 0) {
      res.status(404).json({ success: false, message: '房产不存在' });
    } else {
      res.json({
        success: true,
        data: rows[0]  // 直接返回房产数据，不包装在property对象中
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 创建房产
const createProperty = async (req, res) => {
  try {
    const { 
      community_id, 
      property_type, 
      building, 
      unit, 
      room, 
      area, 
      is_delivered,
      is_decorated,
      occupancy_status,
      is_for_rent,
      handover_date,
      owner_id 
    } = req.body;
    
    const [result] = await pool.execute(`
      INSERT INTO properties (
        community_id, property_type, building, unit, room, area,
        is_delivered, is_decorated, occupancy_status, is_for_rent,
        handover_date, owner_id, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `,
      [
        community_id || null,
        property_type || '普通住宅',
        building,
        unit, 
        room,
        area,
        is_delivered || 0,
        is_decorated || 0,
        occupancy_status || '空关',
        is_for_rent || 0,
        handover_date || null,
        owner_id || null
      ]
    );
    
    res.json({ success: true, data: { id: result.insertId } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 更新房产
const updateProperty = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      community_id, 
      property_type, 
      building, 
      unit, 
      room, 
      area,
      is_delivered,
      is_decorated,
      occupancy_status,
      is_for_rent,
      handover_date,
      owner_id 
    } = req.body;
    
    const [result] = await pool.execute(`
      UPDATE properties SET 
        community_id=?, property_type=?, building=?, unit=?, room=?, area=?,
        is_delivered=?, is_decorated=?, occupancy_status=?, is_for_rent=?,
        handover_date=?, owner_id=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `,
      [
        community_id || null,
        property_type || '普通住宅',
        building,
        unit,
        room,
        area,
        is_delivered || 0,
        is_decorated || 0,
        occupancy_status || '空关',
        is_for_rent || 0,
        handover_date || null,
        owner_id || null,
        id
      ]
    );
    
    if (result.affectedRows === 0) {
      res.status(404).json({ success: false, message: '房产不存在' });
    } else {
      res.json({ success: true, message: '房产信息更新成功' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 删除房产
const deleteProperty = async (req, res) => {
  try {
    const { id } = req.params;
    
    // 检查房产是否存在
    const [propertyRows] = await pool.execute('SELECT * FROM properties WHERE id = ?', [id]);
    if (propertyRows.length === 0) {
      return res.status(404).json({ success: false, message: '房产不存在' });
    }
    
    // 检查是否有关联的收费记录
    const [feeRows] = await pool.execute('SELECT COUNT(*) as count FROM fee_records WHERE property_id = ?', [id]);
    
    // 检查是否有关联的租赁合同
    const [contractRows] = await pool.execute('SELECT COUNT(*) as count FROM rental_contracts WHERE property_id = ?', [id]);
    
    if (feeRows[0].count > 0 || contractRows[0].count > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `无法删除房产，该房产关联了${feeRows[0].count}条收费记录和${contractRows[0].count}个租赁合同` 
      });
    }
    
    // 删除房产记录
    const [result] = await pool.execute('DELETE FROM properties WHERE id = ?', [id]);
    res.json({ success: true, message: '房产删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 获取房产照片
const getPropertyPhotos = async (req, res) => {
  try {
    const { id } = req.params;
    
    const [rows] = await pool.execute('SELECT photos FROM properties WHERE id = ?', [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: '房产不存在' });
    }
    
    let photos = [];
    if (rows[0].photos) {
      const photoUrls = JSON.parse(rows[0].photos);
      photos = photoUrls.map(url => ({ url }));
    }
    
    res.json({ success: true, data: photos });
  } catch (error) {
    console.error('获取房产照片失败:', error);
    res.status(500).json({ success: false, message: '获取房产照片失败' });
  }
};

// 上传房产照片
const uploadPropertyPhoto = async (req, res) => {
  try {
    const { id } = req.params;
    
    // 验证房产ID - 更严格的验证
    if (!id || id === 'undefined' || id === 'null' || isNaN(parseInt(id))) {
      // 如果上传的文件存在，删除它以避免垃圾文件
      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ success: false, message: '无效的房产ID，请先选择要编辑的房产' });
    }
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: '请选择要上传的图片' });
    }
    
    const propertyId = parseInt(id);
    
    // 验证解析后的ID是否有效
    if (propertyId <= 0) {
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ success: false, message: '房产ID必须是正整数' });
    }
    
    const photoUrl = `/uploads/properties/${req.file.filename}`;
    
    // 先检查房产是否存在
    const [checkRows] = await pool.execute('SELECT id FROM properties WHERE id = ?', [propertyId]);
    if (checkRows.length === 0) {
      // 删除已上传的文件
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({ success: false, message: '房产不存在' });
    }
    
    // 获取现有照片列表
    const [rows] = await pool.execute('SELECT photos FROM properties WHERE id = ?', [propertyId]);
    
    let photos = [];
    if (rows.length > 0 && rows[0].photos) {
      try {
        photos = JSON.parse(rows[0].photos) || [];
      } catch (e) {
        console.warn('解析现有照片数据失败:', e);
        photos = [];
      }
    }
    
    // 添加新照片
    photos.push(photoUrl);
    
    // 更新数据库
    const [result] = await pool.execute('UPDATE properties SET photos = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
      [JSON.stringify(photos), propertyId]
    );
    
    if (result.affectedRows === 0) {
      // 删除已上传的文件
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({ success: false, message: '更新失败，房产不存在' });
    }
    
    console.log(`✅ 房产 ${propertyId} 照片上传成功: ${photoUrl}`);
    res.json({ 
      success: true, 
      message: '照片上传成功',
      data: { photo_url: photoUrl, photos: photos }
    });
  } catch (error) {
    console.error('房产照片上传错误:', error);
    // 如果有文件上传，删除它
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ success: false, message: '上传失败: ' + error.message });
  }
};

// 删除房产照片
const deletePropertyPhoto = async (req, res) => {
  try {
    const { id } = req.params;
    const { photo_url } = req.body;
    
    if (!photo_url) {
      return res.status(400).json({ success: false, message: '请提供要删除的照片URL' });
    }
    
    // 获取现有照片列表
    const [rows] = await pool.execute('SELECT photos FROM properties WHERE id = ?', [id]);
    
    if (rows.length === 0 || !rows[0].photos) {
      return res.status(404).json({ success: false, message: '该房产没有照片' });
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
    const [result] = await pool.execute('UPDATE properties SET photos = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
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
  getProperties, 
  getPropertyById,
  createProperty, 
  updateProperty, 
  deleteProperty,
  getPropertyPhotos,
  uploadPropertyPhoto,
  deletePropertyPhoto,
  upload  // 导出multer实例供路由使用
};