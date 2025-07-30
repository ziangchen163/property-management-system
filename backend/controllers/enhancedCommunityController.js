const { pool } = require('../config/database');

// ========== 小区管理 ==========

// 获取所有小区
const getCommunities = async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT c.*, 
        COUNT(DISTINCT p.id) as property_count,
        COUNT(DISTINCT ps.id) as parking_count
      FROM communities c
      LEFT JOIN properties p ON c.id = p.community_id
      LEFT JOIN parking_spaces ps ON c.id = ps.community_id
      WHERE c.is_active = 1
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 获取单个小区详情
const getCommunityById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const [communityRows] = await pool.execute(
      'SELECT * FROM communities WHERE id = ? AND is_active = 1', 
      [id]
    );
    
    if (communityRows.length === 0) {
      return res.status(404).json({ success: false, message: '小区不存在' });
    }
    
    // 获取房产性质
    const [propertyTypes] = await pool.execute(
      'SELECT * FROM property_types WHERE community_id = ? AND is_active = 1',
      [id]
    );
    
    // 获取车位类型
    const [parkingTypes] = await pool.execute(
      'SELECT * FROM parking_types WHERE community_id = ? AND is_active = 1',
      [id]
    );
    
    // 获取收费标准
    const [feeRates] = await pool.execute(`
      SELECT cfr.*, fi.name as fee_item_name, 
        pt.type_name as property_type_name,
        pkt.type_name as parking_type_name
      FROM community_fee_rates cfr
      LEFT JOIN fee_items fi ON cfr.fee_item_id = fi.id
      LEFT JOIN property_types pt ON cfr.property_type_id = pt.id
      LEFT JOIN parking_types pkt ON cfr.parking_type_id = pkt.id
      WHERE cfr.community_id = ? AND cfr.is_active = 1
      ORDER BY fi.name, pt.type_name, pkt.type_name
    `, [id]);
    
    res.json({
      success: true,
      data: {
        community: communityRows[0],
        property_types: propertyTypes,
        parking_types: parkingTypes,
        fee_rates: feeRates
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 创建小区
const createCommunity = async (req, res) => {
  try {
    const { name, address, description, manager_name, manager_phone } = req.body;
    
    const [result] = await pool.execute(
      'INSERT INTO communities (name, address, description, manager_name, manager_phone) VALUES (?, ?, ?, ?, ?)',
      [name, address, description, manager_name, manager_phone]
    );
    
    res.json({ success: true, data: { id: result.insertId } });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ success: false, message: '小区名称已存在' });
    } else {
      res.status(500).json({ success: false, message: error.message });
    }
  }
};

// 更新小区
const updateCommunity = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, address, description, manager_name, manager_phone } = req.body;
    
    const [result] = await pool.execute(
      'UPDATE communities SET name=?, address=?, description=?, manager_name=?, manager_phone=? WHERE id=?',
      [name, address, description, manager_name, manager_phone, id]
    );
    
    if (result.affectedRows === 0) {
      res.status(404).json({ success: false, message: '小区不存在' });
    } else {
      res.json({ success: true, message: '小区更新成功' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== 房产性质管理 ==========

// 获取房产性质
const getPropertyTypes = async (req, res) => {
  try {
    const { community_id } = req.query;
    
    let query = `
      SELECT pt.*, c.name as community_name
      FROM property_types pt
      LEFT JOIN communities c ON pt.community_id = c.id
      WHERE pt.is_active = 1
    `;
    
    const params = [];
    if (community_id) {
      query += ' AND pt.community_id = ?';
      params.push(community_id);
    }
    
    query += ' ORDER BY c.name, pt.type_name';
    
    const [rows] = await pool.execute(query, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 创建房产性质
const createPropertyType = async (req, res) => {
  try {
    const { community_id, type_name, description } = req.body;
    
    const [result] = await pool.execute(
      'INSERT INTO property_types (community_id, type_name, description) VALUES (?, ?, ?)',
      [community_id, type_name, description]
    );
    
    res.json({ success: true, data: { id: result.insertId } });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ success: false, message: '该小区已存在相同的房产性质' });
    } else {
      res.status(500).json({ success: false, message: error.message });
    }
  }
};

// 更新房产性质
const updatePropertyType = async (req, res) => {
  try {
    const { id } = req.params;
    const { type_name, description } = req.body;
    
    const [result] = await pool.execute(
      'UPDATE property_types SET type_name=?, description=? WHERE id=?',
      [type_name, description, id]
    );
    
    if (result.affectedRows === 0) {
      res.status(404).json({ success: false, message: '房产性质不存在' });
    } else {
      res.json({ success: true, message: '房产性质更新成功' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== 车位类型管理 ==========

// 获取车位类型
const getParkingTypes = async (req, res) => {
  try {
    const { community_id } = req.query;
    
    let query = `
      SELECT pkt.*, c.name as community_name
      FROM parking_types pkt
      LEFT JOIN communities c ON pkt.community_id = c.id
      WHERE pkt.is_active = 1
    `;
    
    const params = [];
    if (community_id) {
      query += ' AND pkt.community_id = ?';
      params.push(community_id);
    }
    
    query += ' ORDER BY c.name, pkt.type_name';
    
    const [rows] = await pool.execute(query, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 创建车位类型
const createParkingType = async (req, res) => {
  try {
    const { community_id, type_name, description } = req.body;
    
    const [result] = await pool.execute(
      'INSERT INTO parking_types (community_id, type_name, description) VALUES (?, ?, ?)',
      [community_id, type_name, description]
    );
    
    res.json({ success: true, data: { id: result.insertId } });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ success: false, message: '该小区已存在相同的车位类型' });
    } else {
      res.status(500).json({ success: false, message: error.message });
    }
  }
};

// 更新车位类型
const updateParkingType = async (req, res) => {
  try {
    const { id } = req.params;
    const { type_name, description } = req.body;
    
    const [result] = await pool.execute(
      'UPDATE parking_types SET type_name=?, description=? WHERE id=?',
      [type_name, description, id]
    );
    
    if (result.affectedRows === 0) {
      res.status(404).json({ success: false, message: '车位类型不存在' });
    } else {
      res.json({ success: true, message: '车位类型更新成功' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== 收费标准管理 ==========

// 获取收费标准
const getCommunityFeeRates = async (req, res) => {
  try {
    const { community_id } = req.query;
    
    let query = `
      SELECT cfr.*, 
        c.name as community_name,
        fi.name as fee_item_name, fi.category,
        pt.type_name as property_type_name,
        pkt.type_name as parking_type_name
      FROM community_fee_rates cfr
      LEFT JOIN communities c ON cfr.community_id = c.id
      LEFT JOIN fee_items fi ON cfr.fee_item_id = fi.id
      LEFT JOIN property_types pt ON cfr.property_type_id = pt.id
      LEFT JOIN parking_types pkt ON cfr.parking_type_id = pkt.id
      WHERE cfr.is_active = 1
    `;
    
    const params = [];
    if (community_id) {
      query += ' AND cfr.community_id = ?';
      params.push(community_id);
    }
    
    query += ' ORDER BY c.name, fi.category, fi.name, pt.type_name, pkt.type_name';
    
    const [rows] = await pool.execute(query, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 设置收费标准
const setCommunityFeeRate = async (req, res) => {
  try {
    const { 
      community_id, 
      fee_item_id, 
      property_type_id, 
      parking_type_id, 
      unit_price, 
      effective_date 
    } = req.body;
    
    // 检查是否已存在相同配置
    let checkQuery = `
      SELECT id FROM community_fee_rates 
      WHERE community_id = ? AND fee_item_id = ? AND is_active = 1
    `;
    const checkParams = [community_id, fee_item_id];
    
    if (property_type_id) {
      checkQuery += ' AND property_type_id = ?';
      checkParams.push(property_type_id);
    } else {
      checkQuery += ' AND property_type_id IS NULL';
    }
    
    if (parking_type_id) {
      checkQuery += ' AND parking_type_id = ?';
      checkParams.push(parking_type_id);
    } else {
      checkQuery += ' AND parking_type_id IS NULL';
    }
    
    const [existing] = await pool.execute(checkQuery, checkParams);
    
    if (existing.length > 0) {
      // 更新现有记录
      await pool.execute(
        'UPDATE community_fee_rates SET unit_price = ?, effective_date = ? WHERE id = ?',
        [unit_price, effective_date, existing[0].id]
      );
    } else {
      // 插入新记录
      await pool.execute(
        'INSERT INTO community_fee_rates (community_id, fee_item_id, property_type_id, parking_type_id, unit_price, effective_date) VALUES (?, ?, ?, ?, ?, ?)',
        [community_id, fee_item_id, property_type_id, parking_type_id, unit_price, effective_date]
      );
    }
    
    res.json({ success: true, message: '收费标准设置成功' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  // 小区管理
  getCommunities,
  getCommunityById,
  createCommunity,
  updateCommunity,
  
  // 房产性质管理
  getPropertyTypes,
  createPropertyType,
  updatePropertyType,
  
  // 车位类型管理
  getParkingTypes,
  createParkingType,
  updateParkingType,
  
  // 收费标准管理
  getCommunityFeeRates,
  setCommunityFeeRate
};