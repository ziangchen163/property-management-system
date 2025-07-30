const { pool } = require('../config/database');

// ========== 水费管理 ==========

// 获取水表抄表记录
const getWaterReadings = async (req, res) => {
  try {
    const { property_id } = req.query;
    
    let query = `
      SELECT 
        wr.*,
        p.building, p.unit, p.room,
        o.name as owner_name
      FROM water_readings wr
      LEFT JOIN properties p ON wr.property_id = p.id
      LEFT JOIN owners o ON p.owner_id = o.id
      WHERE 1=1
    `;
    
    const params = [];
    if (property_id) {
      query += ' AND wr.property_id = ?';
      params.push(property_id);
    }
    
    query += ' ORDER BY wr.reading_date DESC';
    
    const [rows] = await pool.execute(query, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 添加水表抄表记录
const createWaterReading = async (req, res) => {
  try {
    const { property_id, reading_date, current_reading, unit_price, reading_type, remark } = req.body;
    
    // 获取上次读数
    const [previousRows] = await pool.execute(
      'SELECT current_reading FROM water_readings WHERE property_id = ? ORDER BY reading_date DESC LIMIT 1',
      [property_id]
    );
    const previousReading = previousRows[0] ? previousRows[0].current_reading : 0;
    
    const usage = current_reading - previousReading;
    const amount = usage * (unit_price || 3.5);
    
    const [result] = await pool.execute(
      `INSERT INTO water_readings 
       (property_id, reading_date, current_reading, previous_reading, usage_amount, unit_price, amount, reading_type, remark)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [property_id, reading_date, current_reading, previousReading, usage, unit_price || 3.5, amount, reading_type || 'monthly', remark]
    );
    
    // 创建费用记录
    if (amount > 0) {
      await pool.execute(
        `INSERT INTO fee_records (property_id, fee_item_id, amount, period_start, period_end, status, remark)
         VALUES (?, 3, ?, ?, ?, 'unpaid', ?)`,
        [property_id, amount, reading_date, reading_date, `水费 ${usage}吨`]
      );
    }
    
    res.json({ 
      success: true, 
      data: { 
        id: result.insertId,
        usage: usage,
        amount: amount
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== 电费管理 ==========

// 获取电表抄表记录
const getElectricityReadings = async (req, res) => {
  try {
    const { property_id } = req.query;
    
    let query = `
      SELECT 
        er.*,
        p.building, p.unit, p.room, p.property_type,
        o.name as owner_name,
        elr.unit_price as standard_unit_price
      FROM electricity_readings er
      LEFT JOIN properties p ON er.property_id = p.id
      LEFT JOIN owners o ON p.owner_id = o.id
      LEFT JOIN electricity_rates elr ON p.property_type = elr.property_type
      WHERE 1=1
    `;
    
    const params = [];
    if (property_id) {
      query += ' AND er.property_id = ?';
      params.push(property_id);
    }
    
    query += ' ORDER BY er.reading_date DESC';
    
    const [rows] = await pool.execute(query, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 添加电表抄表记录
const createElectricityReading = async (req, res) => {
  try {
    const { property_id, reading_date, current_reading, reading_type, prepaid_amount, remark } = req.body;
    
    // 获取房产类型对应的电费单价
    const [propertyRows] = await pool.execute(
      `SELECT p.property_type, er.unit_price 
       FROM properties p 
       LEFT JOIN electricity_rates er ON p.property_type = er.property_type 
       WHERE p.id = ?`,
      [property_id]
    );
    
    const propertyInfo = propertyRows[0];
    if (!propertyInfo) {
      return res.status(404).json({ success: false, message: '房产信息不存在' });
    }
    
    // 获取上次读数和预付费余额
    const [previousRows] = await pool.execute(
      'SELECT current_reading, prepaid_balance FROM electricity_readings WHERE property_id = ? ORDER BY reading_date DESC LIMIT 1',
      [property_id]
    );
    
    const previousData = previousRows[0] ? previousRows[0] : { current_reading: 0, prepaid_balance: 0 };
    
    const usage = current_reading - previousData.current_reading;
    const amount = usage * propertyInfo.unit_price;
    const newBalance = previousData.prepaid_balance + (prepaid_amount || 0) - amount;
    
    const [result] = await pool.execute(
      `INSERT INTO electricity_readings 
       (property_id, reading_date, current_reading, previous_reading, usage_amount, unit_price, amount, reading_type, prepaid_balance, remark)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [property_id, reading_date, current_reading, previousData.current_reading, usage, 
       propertyInfo.unit_price, amount, reading_type || 'monthly', newBalance, remark]
    );
    
    // 如果余额不足，创建费用记录
    if (newBalance < 0) {
      await pool.execute(
        `INSERT INTO fee_records (property_id, fee_item_id, amount, period_start, period_end, status, remark)
         VALUES (?, 4, ?, ?, ?, 'unpaid', ?)`,
        [property_id, Math.abs(newBalance), reading_date, reading_date, `电费欠费 ${usage}度`]
      );
    }
    
    res.json({ 
      success: true, 
      data: { 
        id: result.insertId,
        usage: usage,
        amount: amount,
        balance: newBalance,
        balance_status: newBalance >= 0 ? 'sufficient' : 'insufficient'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 电费预付费充值
const rechargeElectricity = async (req, res) => {
  try {
    const { property_id, amount, remark } = req.body;
    
    // 获取最新余额
    const [balanceRows] = await pool.execute(
      'SELECT prepaid_balance FROM electricity_readings WHERE property_id = ? ORDER BY reading_date DESC LIMIT 1',
      [property_id]
    );
    
    const currentBalance = balanceRows[0] ? balanceRows[0].prepaid_balance : 0;
    const newBalance = currentBalance + amount;
    const today = new Date().toISOString().split('T')[0];
    
    // 创建充值记录
    const [result] = await pool.execute(
      `INSERT INTO electricity_readings 
       (property_id, reading_date, current_reading, previous_reading, usage_amount, unit_price, amount, reading_type, prepaid_balance, remark)
       VALUES (?, ?, 0, 0, 0, 0, ?, 'recharge', ?, ?)`,
      [property_id, today, -amount, newBalance, remark || '预付费充值']
    );
    
    res.json({ 
      success: true, 
      message: '充值成功',
      data: {
        previous_balance: currentBalance,
        recharge_amount: amount,
        new_balance: newBalance
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== 押金管理 ==========

// 获取押金记录
const getDepositRecords = async (req, res) => {
  try {
    const { property_id } = req.query;
    
    let query = `
      SELECT 
        dr.*,
        p.building, p.unit, p.room,
        o.name as owner_name
      FROM deposit_records dr
      LEFT JOIN properties p ON dr.property_id = p.id
      LEFT JOIN owners o ON p.owner_id = o.id
      WHERE 1=1
    `;
    
    const params = [];
    if (property_id) {
      query += ' AND dr.property_id = ?';
      params.push(property_id);
    }
    
    query += ' ORDER BY dr.created_at DESC';
    
    const [rows] = await pool.execute(query, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 创建押金记录
const createDepositRecord = async (req, res) => {
  try {
    const { property_id, deposit_type, amount, paid_date, remark } = req.body;
    
    const [result] = await pool.execute(
      `INSERT INTO deposit_records (property_id, deposit_type, amount, balance, paid_date, remark)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [property_id, deposit_type, amount, amount, paid_date, remark]
    );
    
    res.json({ success: true, data: { id: result.insertId } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 押金扣费
const deductDeposit = async (req, res) => {
  try {
    const { id } = req.params;
    const { deduct_amount, remark } = req.body;
    
    // 获取当前余额
    const [depositRows] = await pool.execute('SELECT * FROM deposit_records WHERE id = ?', [id]);
    
    const deposit = depositRows[0];
    if (!deposit) {
      return res.status(404).json({ success: false, message: '押金记录不存在' });
    }
    
    if (deposit.balance < deduct_amount) {
      return res.status(400).json({ success: false, message: '押金余额不足' });
    }
    
    const newBalance = deposit.balance - deduct_amount;
    
    const [result] = await pool.execute(
      'UPDATE deposit_records SET balance = ?, remark = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newBalance, `${deposit.remark || ''} | 扣费：${deduct_amount}元 ${remark || ''}`.trim(), id]
    );
    
    res.json({ 
      success: true, 
      message: '押金扣费成功',
      data: {
        previous_balance: deposit.balance,
        deduct_amount: deduct_amount,
        new_balance: newBalance
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  // 水费管理
  getWaterReadings,
  createWaterReading,
  
  // 电费管理
  getElectricityReadings,
  createElectricityReading,
  rechargeElectricity,
  
  // 押金管理
  getDepositRecords,
  createDepositRecord,
  deductDeposit
};