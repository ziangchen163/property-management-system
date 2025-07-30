const { pool } = require('../config/database');

// 获取所有收费记录
const getFeeRecords = async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT f.*, p.building, p.unit, p.room, p.property_type, o.name as owner_name 
      FROM fee_records f
      LEFT JOIN properties p ON f.property_id = p.id
      LEFT JOIN owners o ON p.owner_id = o.id
      ORDER BY f.due_date DESC, f.created_at DESC
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 创建收费记录
const createFeeRecord = async (req, res) => {
  try {
    const { property_id, fee_type, amount, period, due_date } = req.body;
    
    const [result] = await pool.execute(
      'INSERT INTO fee_records (property_id, fee_type, amount, period, due_date) VALUES (?, ?, ?, ?, ?)',
      [property_id, fee_type, amount, period, due_date]
    );
    
    res.json({ success: true, data: { id: result.insertId } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 更新收费记录状态
const updateFeeRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const paid_date = status === 'paid' ? new Date().toISOString().split('T')[0] : null;
    
    const [result] = await pool.execute(
      'UPDATE fee_records SET status=?, paid_date=? WHERE id=?',
      [status, paid_date, id]
    );
    
    if (result.affectedRows === 0) {
      res.status(404).json({ success: false, message: '收费记录不存在' });
    } else {
      res.json({ success: true, message: '收费记录更新成功' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 获取收费统计
const getFeeStats = async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid,
        SUM(CASE WHEN status = 'unpaid' THEN 1 ELSE 0 END) as unpaid,
        SUM(amount) as total_amount,
        SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as paid_amount,
        SUM(CASE WHEN status = 'unpaid' THEN amount ELSE 0 END) as unpaid_amount
      FROM fee_records
    `);
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== 收费项目管理 ==========

// 获取所有收费项目
const getFeeItems = async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT * FROM fee_items 
      WHERE is_active = 1
      ORDER BY created_at ASC
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 根据ID获取收费项目详情
const getFeeItemById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const [rows] = await pool.execute('SELECT * FROM fee_items WHERE id = ?', [id]);
    
    if (rows.length === 0) {
      res.status(404).json({ success: false, message: '收费项目不存在' });
    } else {
      res.json({
        success: true,
        data: {
          fee_item: rows[0]
        }
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 创建收费项目
const createFeeItem = async (req, res) => {
  try {
    const { name, unit_price, calculation_method, description } = req.body;
    
    // 检查项目名称唯一性
    const [nameRows] = await pool.execute('SELECT id FROM fee_items WHERE name = ? AND is_active = 1', [name]);
    
    if (nameRows.length > 0) {
      return res.status(400).json({ success: false, message: '收费项目名称已存在' });
    }
    
    const [result] = await pool.execute(
      'INSERT INTO fee_items (name, unit_price, calculation_method, description) VALUES (?, ?, ?, ?)',
      [name, unit_price || null, calculation_method || null, description || null]
    );
    
    res.json({ success: true, data: { id: result.insertId } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 更新收费项目
const updateFeeItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, unit_price, calculation_method, description } = req.body;
    
    // 检查项目名称唯一性
    const [nameRows] = await pool.execute('SELECT id FROM fee_items WHERE name = ? AND id != ? AND is_active = 1', [name, id]);
    
    if (nameRows.length > 0) {
      return res.status(400).json({ success: false, message: '收费项目名称已存在' });
    }
    
    const [result] = await pool.execute(
      'UPDATE fee_items SET name=?, unit_price=?, calculation_method=?, description=? WHERE id=?',
      [name, unit_price || null, calculation_method || null, description || null, id]
    );
    
    if (result.affectedRows === 0) {
      res.status(404).json({ success: false, message: '收费项目不存在' });
    } else {
      res.json({ success: true, message: '收费项目更新成功' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 停用收费项目
const deactivateFeeItem = async (req, res) => {
  try {
    const { id } = req.params;
    
    const [result] = await pool.execute(
      'UPDATE fee_items SET is_active=0 WHERE id=?',
      [id]
    );
    
    if (result.affectedRows === 0) {
      res.status(404).json({ success: false, message: '收费项目不存在' });
    } else {
      res.json({ success: true, message: '收费项目已停用' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 激活收费项目
const activateFeeItem = async (req, res) => {
  try {
    const { id } = req.params;
    
    const [result] = await pool.execute(
      'UPDATE fee_items SET is_active=1 WHERE id=?',
      [id]
    );
    
    if (result.affectedRows === 0) {
      res.status(404).json({ success: false, message: '收费项目不存在' });
    } else {
      res.json({ success: true, message: '收费项目已激活' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { 
  getFeeRecords, 
  createFeeRecord, 
  updateFeeRecord, 
  getFeeStats,
  // 收费项目管理
  getFeeItems,
  getFeeItemById,
  createFeeItem,
  updateFeeItem,
  deactivateFeeItem,
  activateFeeItem
};