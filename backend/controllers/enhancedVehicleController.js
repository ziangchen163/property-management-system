const { pool } = require('../config/database');

// ========== 车位车辆绑定管理 ==========

// 获取车位车辆绑定关系
const getParkingVehicleBindings = async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT 
        pvb.*,
        ps.space_number,
        ps.type as parking_type,
        v.license_plate,
        v.car_model,
        o.name as owner_name,
        c.name as community_name
      FROM parking_vehicle_bindings pvb
      LEFT JOIN parking_spaces ps ON pvb.parking_space_id = ps.id
      LEFT JOIN vehicles v ON pvb.vehicle_id = v.id
      LEFT JOIN owners o ON v.owner_id = o.id
      LEFT JOIN communities c ON ps.community_id = c.id
      WHERE pvb.status = 'active'
      ORDER BY pvb.created_at DESC
    `);
    
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 创建车位车辆绑定
const createParkingVehicleBinding = async (req, res) => {
  try {
    const { parking_space_id, vehicle_id, binding_type, start_date, end_date } = req.body;
    
    // 检查车位是否已被绑定
    const [existingRows] = await pool.execute(
      'SELECT id FROM parking_vehicle_bindings WHERE parking_space_id = ? AND status = "active"',
      [parking_space_id]
    );
    const existingBinding = existingRows[0];
    
    if (existingBinding) {
      return res.status(400).json({ success: false, message: '该车位已有车辆绑定' });
    }
    
    const [result] = await pool.execute(
      'INSERT INTO parking_vehicle_bindings (parking_space_id, vehicle_id, binding_type, start_date, end_date) VALUES (?, ?, ?, ?, ?)',
      [parking_space_id, vehicle_id, binding_type || 'owner', start_date, end_date]
    );
    
    res.json({ success: true, data: { id: result.insertId } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 解除车位车辆绑定
const removeParkingVehicleBinding = async (req, res) => {
  try {
    const { id } = req.params;
    
    const [result] = await pool.execute(
      'UPDATE parking_vehicle_bindings SET status = "expired", updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [id]
    );
    
    if (result.affectedRows === 0) {
      res.status(404).json({ success: false, message: '绑定关系不存在' });
    } else {
      res.json({ success: true, message: '车位车辆绑定已解除' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== 车辆违章管理 ==========

// 获取车辆违章记录
const getVehicleViolations = async (req, res) => {
  try {
    const { vehicle_id, status } = req.query;
    
    let query = `
      SELECT 
        vv.*,
        v.license_plate,
        v.car_model,
        o.name as owner_name,
        o.phone as owner_phone
      FROM vehicle_violations vv
      LEFT JOIN vehicles v ON vv.vehicle_id = v.id
      LEFT JOIN owners o ON v.owner_id = o.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (vehicle_id) {
      query += ' AND vv.vehicle_id = ?';
      params.push(vehicle_id);
    }
    
    if (status) {
      query += ' AND vv.status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY vv.violation_date DESC';
    
    const [rows] = await pool.execute(query, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 创建车辆违章记录
const createVehicleViolation = async (req, res) => {
  try {
    const { 
      vehicle_id, violation_date, violation_type, location, 
      fine_amount, description 
    } = req.body;
    
    const [result] = await pool.execute(
      'INSERT INTO vehicle_violations (vehicle_id, violation_date, violation_type, location, fine_amount, description) VALUES (?, ?, ?, ?, ?, ?)',
      [vehicle_id, violation_date, violation_type, location, fine_amount || 0, description]
    );
    
    res.json({ success: true, data: { id: result.insertId } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 更新违章状态
const updateViolationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, description } = req.body;
    
    const [result] = await pool.execute(
      'UPDATE vehicle_violations SET status = ?, description = ? WHERE id = ?',
      [status, description, id]
    );
    
    if (result.affectedRows === 0) {
      res.status(404).json({ success: false, message: '违章记录不存在' });
    } else {
      res.json({ success: true, message: '违章状态更新成功' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 获取违章统计
const getViolationStats = async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT 
        COUNT(*) as total_violations,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_violations,
        SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_violations,
        SUM(fine_amount) as total_fines,
        SUM(CASE WHEN status = 'paid' THEN fine_amount ELSE 0 END) as paid_fines,
        SUM(CASE WHEN status = 'pending' THEN fine_amount ELSE 0 END) as pending_fines
      FROM vehicle_violations
    `);
    
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== 业主车位车辆关联查询 ==========

// 获取业主的车辆和车位信息
const getOwnerVehiclesAndParkings = async (req, res) => {
  try {
    const { owner_id } = req.params;
    
    // 获取业主车辆
    const [vehicles] = await pool.execute(
      'SELECT * FROM vehicles WHERE owner_id = ?',
      [owner_id]
    );
    
    // 获取业主车位
    const [parkingSpaces] = await pool.execute(
      `SELECT ps.*, c.name as community_name 
       FROM parking_spaces ps 
       LEFT JOIN communities c ON ps.community_id = c.id 
       WHERE ps.owner_id = ? AND ps.is_active = 1`,
      [owner_id]
    );
    
    // 获取车位车辆绑定关系
    const [bindings] = await pool.execute(
      `SELECT pvb.*, ps.space_number, v.license_plate 
       FROM parking_vehicle_bindings pvb
       LEFT JOIN parking_spaces ps ON pvb.parking_space_id = ps.id
       LEFT JOIN vehicles v ON pvb.vehicle_id = v.id
       WHERE (ps.owner_id = ? OR v.owner_id = ?) AND pvb.status = 'active'`,
      [owner_id, owner_id]
    );
    
    res.json({ 
      success: true, 
      data: {
        vehicles: vehicles,
        parking_spaces: parkingSpaces,
        bindings: bindings
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  // 车位车辆绑定
  getParkingVehicleBindings,
  createParkingVehicleBinding,
  removeParkingVehicleBinding,
  
  // 车辆违章
  getVehicleViolations,
  createVehicleViolation,
  updateViolationStatus,
  getViolationStats,
  
  // 综合查询
  getOwnerVehiclesAndParkings
};