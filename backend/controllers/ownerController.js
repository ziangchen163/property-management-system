const { pool } = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 配置文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads/owners');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = `owner_${Date.now()}_${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
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

// 获取所有业主
const getOwners = async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT o.*, 
             COUNT(DISTINCT p.id) as property_count,
             COUNT(DISTINCT ps.id) as parking_count
      FROM owners o
      LEFT JOIN properties p ON o.id = p.owner_id
      LEFT JOIN parking_spaces ps ON o.id = ps.owner_id
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 根据ID获取业主详细信息
const getOwnerById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // 获取业主基本信息
    const [ownerRows] = await pool.execute('SELECT * FROM owners WHERE id = ?', [id]);
    if (ownerRows.length === 0) {
      return res.status(404).json({ success: false, message: '业主不存在' });
    }
    const owner = ownerRows[0];
    
    // 获取业主的房产信息
    const [properties] = await pool.execute(`
      SELECT p.*, c.name as community_name 
      FROM properties p 
      LEFT JOIN communities c ON p.community_id = c.id 
      WHERE p.owner_id = ?
    `, [id]);
    
    // 获取业主的车位信息
    const [parkingSpaces] = await pool.execute(`
      SELECT ps.*, c.name as community_name 
      FROM parking_spaces ps 
      LEFT JOIN communities c ON ps.community_id = c.id 
      WHERE ps.owner_id = ?
    `, [id]);
    
    res.json({
      success: true,
      data: {
        owner: owner,
        properties: properties,
        parkingSpaces: parkingSpaces
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 创建业主
const createOwner = async (req, res) => {
  try {
    const { name, phone, id_card, company, position, hobby, remark } = req.body;
    
    const [result] = await pool.execute(
      `INSERT INTO owners (name, phone, id_card, company, position, hobby, remark) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, phone || null, id_card || null, company, position, hobby, remark]
    );
    
    res.json({ success: true, data: { id: result.insertId } });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      const field = error.message.includes('phone') ? '电话号码' : '身份证号码';
      res.status(400).json({ success: false, message: `${field}已存在` });
    } else {
      res.status(500).json({ success: false, message: error.message });
    }
  }
};

// 更新业主信息
const updateOwner = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, id_card, company, position, hobby, remark } = req.body;
    
    const [result] = await pool.execute(
      `UPDATE owners 
       SET name=?, phone=?, id_card=?, company=?, position=?, hobby=?, remark=?, updated_at=CURRENT_TIMESTAMP 
       WHERE id=?`,
      [name, phone || null, id_card || null, company, position, hobby, remark, id]
    );
    
    if (result.affectedRows === 0) {
      res.status(404).json({ success: false, message: '业主不存在' });
    } else {
      res.json({ success: true, message: '业主信息更新成功' });
    }
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      const field = error.message.includes('phone') ? '电话号码' : '身份证号码';
      res.status(400).json({ success: false, message: `${field}已存在` });
    } else {
      res.status(500).json({ success: false, message: error.message });
    }
  }
};

// 搜索业主（按姓名或电话）
const searchOwners = async (req, res) => {
  try {
    const { keyword } = req.query;
    
    if (!keyword) {
      return res.status(400).json({ success: false, message: '请提供搜索关键词' });
    }
    
    const [rows] = await pool.execute(`
      SELECT o.*, 
             COUNT(DISTINCT p.id) as property_count,
             COUNT(DISTINCT ps.id) as parking_count
      FROM owners o
      LEFT JOIN properties p ON o.id = p.owner_id
      LEFT JOIN parking_spaces ps ON o.id = ps.owner_id
      WHERE o.name LIKE ? OR o.phone LIKE ?
      GROUP BY o.id
      ORDER BY o.name
    `, [`%${keyword}%`, `%${keyword}%`]);
    
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 获取业主的欠费信息
const getOwnerOutstandingFees = async (req, res) => {
  try {
    const { id } = req.params;
    
    const [rows] = await pool.execute(`
      SELECT fr.*, fi.name as fee_name, p.building, p.unit, p.room,
             ps.space_number, c.name as community_name
      FROM fee_records fr
      LEFT JOIN fee_items fi ON fr.fee_item_id = fi.id
      LEFT JOIN properties p ON fr.property_id = p.id
      LEFT JOIN parking_spaces ps ON fr.parking_space_id = ps.id
      LEFT JOIN communities c ON (p.community_id = c.id OR ps.community_id = c.id)
      WHERE fr.owner_id = ? AND fr.status = 'unpaid'
      ORDER BY fr.due_date ASC
    `, [id]);
    
    const totalAmount = rows.reduce((sum, row) => sum + parseFloat(row.amount), 0);
    res.json({ 
      success: true, 
      data: {
        fees: rows,
        totalAmount: totalAmount
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 上传业主照片
const uploadOwnerPhoto = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: '请选择要上传的图片' });
    }
    
    const photoUrl = `/uploads/owners/${req.file.filename}`;
    
    // 获取旧照片路径以便删除
    const [rows] = await pool.execute('SELECT photo_url FROM owners WHERE id = ?', [id]);
    const oldPhotoUrl = rows.length > 0 ? rows[0].photo_url : null;
    
    // 更新数据库中的照片路径
    const [result] = await pool.execute(
      'UPDATE owners SET photo_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
      [photoUrl, id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: '业主不存在' });
    }
    
    // 删除旧照片文件
    if (oldPhotoUrl) {
      const oldPhotoPath = path.join(__dirname, '..', oldPhotoUrl);
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

// 删除业主照片
const deleteOwnerPhoto = async (req, res) => {
  try {
    const { id } = req.params;
    
    // 获取当前照片路径
    const [rows] = await pool.execute('SELECT photo_url FROM owners WHERE id = ?', [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: '业主不存在' });
    }
    
    const photoUrl = rows[0].photo_url;
    if (!photoUrl) {
      return res.status(404).json({ success: false, message: '该业主没有照片' });
    }
    
    // 删除数据库记录
    await pool.execute('UPDATE owners SET photo_url = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
    
    // 删除文件
    const photoPath = path.join(__dirname, '..', photoUrl);
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

// 删除业主
const deleteOwner = async (req, res) => {
  try {
    const { id } = req.params;
    
    // 检查业主是否存在
    const [ownerRows] = await pool.execute('SELECT * FROM owners WHERE id = ?', [id]);
    if (ownerRows.length === 0) {
      return res.status(404).json({ success: false, message: '业主不存在' });
    }
    const owner = ownerRows[0];
    
    // 检查是否有关联的房产或车位
    const [propRows] = await pool.execute('SELECT COUNT(*) as count FROM properties WHERE owner_id = ?', [id]);
    const [parkRows] = await pool.execute('SELECT COUNT(*) as count FROM parking_spaces WHERE owner_id = ?', [id]);
    
    const propCount = propRows[0].count;
    const parkCount = parkRows[0].count;
    
    if (propCount > 0 || parkCount > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `无法删除业主，该业主名下还有${propCount}个房产和${parkCount}个车位` 
      });
    }
    
    // 删除业主记录
    await pool.execute('DELETE FROM owners WHERE id = ?', [id]);
    
    // 删除业主照片文件
    if (owner.photo_url) {
      const photoPath = path.join(__dirname, '..', owner.photo_url);
      if (fs.existsSync(photoPath)) {
        fs.unlinkSync(photoPath);
      }
    }
    
    res.json({ success: true, message: '业主删除成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { 
  getOwners, 
  getOwnerById, 
  createOwner, 
  updateOwner, 
  deleteOwner,
  searchOwners,
  getOwnerOutstandingFees,
  uploadOwnerPhoto,
  deleteOwnerPhoto,
  upload  // 导出multer实例供路由使用
};