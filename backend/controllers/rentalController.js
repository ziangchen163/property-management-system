const { pool } = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 配置文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads/contracts');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = `contract_${Date.now()}_${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB限制
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype) || file.mimetype.includes('pdf') || file.mimetype.includes('document');
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('只允许上传图片、PDF或文档文件'));
    }
  }
});

// ========== 房屋租售管理 ==========

// 获取可租售房产列表
const getAvailableProperties = async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT 
        p.*,
        c.name as community_name,
        o.name as owner_name,
        o.phone as owner_phone
      FROM properties p
      LEFT JOIN communities c ON p.community_id = c.id
      LEFT JOIN owners o ON p.owner_id = o.id
      WHERE p.is_for_rent = 1
      ORDER BY p.rental_status, p.created_at DESC
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 更新房产租售信息
const updatePropertyRental = async (req, res) => {
  try {
    const { id } = req.params;
    const { rental_status, rental_price, is_for_rent } = req.body;
    
    const [result] = await pool.execute(
      'UPDATE properties SET rental_status=?, rental_price=?, is_for_rent=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
      [rental_status, rental_price, is_for_rent, id]
    );
    
    if (result.affectedRows === 0) {
      res.status(404).json({ success: false, message: '房产不存在' });
    } else {
      res.json({ success: true, message: '房产租售信息更新成功' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== 车位租售管理 ==========

// 获取可租售车位列表
const getAvailableParkingSpaces = async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT 
        ps.*,
        c.name as community_name,
        o.name as owner_name,
        o.phone as owner_phone
      FROM parking_spaces ps
      LEFT JOIN communities c ON ps.community_id = c.id
      LEFT JOIN owners o ON ps.owner_id = o.id
      WHERE ps.status IN ('待出租', '出租中') AND ps.is_active = 1
      ORDER BY ps.rental_status, ps.created_at DESC
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 更新车位租售信息
const updateParkingRental = async (req, res) => {
  try {
    const { id } = req.params;
    const { rental_status, rental_price, location_description } = req.body;
    
    const [result] = await pool.execute(
      'UPDATE parking_spaces SET rental_status=?, rental_price=?, location_description=?, updated_at=CURRENT_TIMESTAMP WHERE id=?',
      [rental_status, rental_price, location_description, id]
    );
    
    if (result.affectedRows === 0) {
      res.status(404).json({ success: false, message: '车位不存在' });
    } else {
      res.json({ success: true, message: '车位租售信息更新成功' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== 合同管理 ==========

// 获取所有租赁合同
const getRentalContracts = async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT 
        rc.*,
        t.name as tenant_name,
        t.phone as tenant_phone,
        t.id_card as tenant_id_card,
        p.building, p.unit, p.room,
        ps.space_number,
        c.name as community_name
      FROM rental_contracts rc
      LEFT JOIN tenants t ON rc.tenant_id = t.id
      LEFT JOIN properties p ON rc.property_id = p.id
      LEFT JOIN parking_spaces ps ON rc.parking_space_id = ps.id
      LEFT JOIN communities c ON (p.community_id = c.id OR ps.community_id = c.id)
      ORDER BY rc.created_at DESC
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 创建租赁合同
const createRentalContract = async (req, res) => {
  try {
    const { 
      contract_number, property_id, parking_space_id, tenant_info, 
      start_date, end_date, monthly_rent, deposit 
    } = req.body;
    
    // 检查合同编号唯一性
    const [existingContracts] = await pool.execute(
      'SELECT id FROM rental_contracts WHERE contract_number = ?', 
      [contract_number]
    );
    const contractExists = existingContracts[0];
    
    if (contractExists) {
      return res.status(400).json({ success: false, message: '合同编号已存在' });
    }
    
    // 处理租客信息（如果租客不存在则创建）
    let tenant_id = tenant_info.id;
    
    if (!tenant_id) {
      // 创建新租客
      const [tenantResult] = await pool.execute(
        'INSERT INTO tenants (name, phone, id_card) VALUES (?, ?, ?)',
        [tenant_info.name, tenant_info.phone, tenant_info.id_card]
      );
      tenant_id = tenantResult.insertId;
    }
    
    // 创建合同
    const [contractResult] = await pool.execute(
      `INSERT INTO rental_contracts 
       (contract_number, property_id, parking_space_id, tenant_id, start_date, end_date, monthly_rent, deposit)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [contract_number, property_id || null, parking_space_id || null, tenant_id, start_date, end_date, monthly_rent, deposit]
    );
    
    // 更新房产/车位状态为出租中
    if (property_id) {
      await pool.execute('UPDATE properties SET rental_status = "出租中" WHERE id = ?', [property_id]);
    }
    if (parking_space_id) {
      await pool.execute('UPDATE parking_spaces SET status = "出租中" WHERE id = ?', [parking_space_id]);
    }
    
    res.json({ 
      success: true, 
      data: { 
        contract_id: contractResult.insertId,
        tenant_id: tenant_id
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 更新合同状态（到期/退租）
const updateContractStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    // 获取合同信息
    const [contractRows] = await pool.execute(
      'SELECT * FROM rental_contracts WHERE id = ?', 
      [id]
    );
    const contract = contractRows[0];
    
    if (!contract) {
      return res.status(404).json({ success: false, message: '合同不存在' });
    }
    
    // 更新合同状态
    await pool.execute(
      'UPDATE rental_contracts SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, id]
    );
    
    // 如果合同到期或退租，更新房产/车位状态
    if (status === 'expired' || status === 'terminated') {
      if (contract.property_id) {
        await pool.execute('UPDATE properties SET rental_status = "available" WHERE id = ?', [contract.property_id]);
      }
      if (contract.parking_space_id) {
        await pool.execute('UPDATE parking_spaces SET status = "待出租" WHERE id = ?', [contract.parking_space_id]);
      }
    }
    
    res.json({ success: true, message: '合同状态更新成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 上传合同文件
const uploadContractFile = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: '请选择要上传的文件' });
    }
    
    const fileUrl = `/uploads/contracts/${req.file.filename}`;
    
    await pool.execute(
      'UPDATE rental_contracts SET contract_file = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [fileUrl, id]
    );
    
    res.json({ 
      success: true, 
      message: '合同文件上传成功',
      data: { file_url: fileUrl }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  // 房屋租售
  getAvailableProperties,
  updatePropertyRental,
  
  // 车位租售
  getAvailableParkingSpaces,
  updateParkingRental,
  
  // 合同管理
  getRentalContracts,
  createRentalContract,
  updateContractStatus,
  uploadContractFile,
  upload
};