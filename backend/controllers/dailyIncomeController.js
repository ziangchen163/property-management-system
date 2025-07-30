const { pool } = require('../config/database');

// ========== 每日收入管理 ==========

// 获取每日收入记录
const getDailyIncomeRecords = async (req, res) => {
  try {
    const { date, income_type } = req.query;
    
    let query = `
      SELECT 
        di.*,
        p.building, p.unit, p.room,
        o.name as owner_name
      FROM daily_income di
      LEFT JOIN properties p ON di.property_id = p.id
      LEFT JOIN owners o ON p.owner_id = o.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (date) {
      query += ' AND di.record_date = ?';
      params.push(date);
    }
    
    if (income_type) {
      query += ' AND di.income_type = ?';
      params.push(income_type);
    }
    
    query += ' ORDER BY di.record_date DESC, di.created_at DESC';
    
    const [rows] = await pool.execute(query, params);
    const total = rows.reduce((sum, record) => sum + record.amount, 0);
    res.json({ 
      success: true, 
      data: {
        records: rows,
        total_amount: total,
        count: rows.length
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 添加门禁卡收费记录
const createAccessCardIncome = async (req, res) => {
  try {
    const { property_id, quantity, unit_price, record_date, description } = req.body;
    
    const amount = quantity * (unit_price || 20); // 默认门禁卡20元/张
    const today = record_date || new Date().toISOString().split('T')[0];
    
    const [result] = await pool.execute(
      `INSERT INTO daily_income (record_date, income_type, property_id, amount, quantity, unit_price, description)
       VALUES (?, '门禁卡', ?, ?, ?, ?, ?)`,
      [today, property_id, amount, quantity, unit_price || 20, description || `门禁卡${quantity}张`]
    );
    
    res.json({ 
      success: true, 
      message: '门禁卡收费记录添加成功',
      data: { 
        id: result.insertId,
        amount: amount
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 添加消防放水费记录
const createFireTestIncome = async (req, res) => {
  try {
    const { property_id, unit_price, record_date, description } = req.body;
    
    const amount = unit_price || 100; // 默认消防放水费100元/次
    const today = record_date || new Date().toISOString().split('T')[0];
    
    const [result] = await pool.execute(
      `INSERT INTO daily_income (record_date, income_type, property_id, amount, quantity, unit_price, description)
       VALUES (?, '消防放水费', ?, ?, 1, ?, ?)`,
      [today, property_id, amount, amount, description || '消防放水费']
    );
    
    res.json({ 
      success: true, 
      message: '消防放水费记录添加成功',
      data: { 
        id: result.insertId,
        amount: amount
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 添加其他收费记录
const createOtherIncome = async (req, res) => {
  try {
    const { property_id, income_type, amount, quantity, unit_price, record_date, description } = req.body;
    
    const finalAmount = amount || (quantity * unit_price);
    const today = record_date || new Date().toISOString().split('T')[0];
    
    const [result] = await pool.execute(
      `INSERT INTO daily_income (record_date, income_type, property_id, amount, quantity, unit_price, description)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [today, income_type || '其他', property_id, finalAmount, quantity || 1, unit_price, description]
    );
    
    res.json({ 
      success: true, 
      message: '收费记录添加成功',
      data: { 
        id: result.insertId,
        amount: finalAmount
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 获取每日收入统计
const getDailyIncomeStats = async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    
    let query = `
      SELECT 
        record_date,
        income_type,
        SUM(amount) as total_amount,
        COUNT(*) as record_count
      FROM daily_income
      WHERE 1=1
    `;
    
    const params = [];
    
    if (start_date) {
      query += ' AND record_date >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      query += ' AND record_date <= ?';
      params.push(end_date);
    }
    
    query += ' GROUP BY record_date, income_type ORDER BY record_date DESC, income_type';
    
    const [rows] = await pool.execute(query, params);
    
    // 按日期分组统计
    const dailyStats = {};
    const typeStats = {};
    let grandTotal = 0;
    
    rows.forEach(row => {
      const date = row.record_date;
      const type = row.income_type;
      const amount = row.total_amount;
      
      if (!dailyStats[date]) {
        dailyStats[date] = { date, total: 0, types: {} };
      }
      dailyStats[date].total += amount;
      dailyStats[date].types[type] = amount;
      
      if (!typeStats[type]) {
        typeStats[type] = 0;
      }
      typeStats[type] += amount;
      
      grandTotal += amount;
    });
    
    res.json({ 
      success: true, 
      data: {
        daily_stats: Object.values(dailyStats),
        type_stats: typeStats,
        grand_total: grandTotal,
        period: {
          start_date: start_date || '不限',
          end_date: end_date || '不限'
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 删除收入记录
const deleteDailyIncomeRecord = async (req, res) => {
  try {
    const { id } = req.params;
    
    const [result] = await pool.execute('DELETE FROM daily_income WHERE id = ?', [id]);
    
    if (result.affectedRows === 0) {
      res.status(404).json({ success: false, message: '记录不存在' });
    } else {
      res.json({ success: true, message: '记录删除成功' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getDailyIncomeRecords,
  createAccessCardIncome,
  createFireTestIncome,
  createOtherIncome,
  getDailyIncomeStats,
  deleteDailyIncomeRecord
};