const { pool } = require('../config/database');

// ========== 押金管理 ==========

// 获取押金记录
const getDepositRecords = async (req, res) => {
  try {
    const { property_id, owner_id, deposit_type, status } = req.query;
    
    let query = `
      SELECT 
        dr.*,
        p.building, p.unit, p.room,
        c.name as community_name,
        o.name as owner_name
      FROM deposit_records dr
      LEFT JOIN properties p ON dr.property_id = p.id
      LEFT JOIN communities c ON dr.community_id = c.id
      LEFT JOIN owners o ON p.owner_id = o.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (property_id) {
      query += ' AND dr.property_id = ?';
      params.push(property_id);
    }
    
    if (owner_id) {
      query += ' AND p.owner_id = ?';
      params.push(owner_id);
    }
    
    if (deposit_type) {
      query += ' AND dr.deposit_type = ?';
      params.push(deposit_type);
    }
    
    if (status) {
      query += ' AND dr.status = ?';
      params.push(status);
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
    const { 
      property_id, 
      deposit_type, 
      amount, 
      paid_date,
      auto_deduct = false,
      remark 
    } = req.body;
    
    // 获取房产的小区信息
    const [propInfo] = await pool.execute(
      'SELECT community_id FROM properties WHERE id = ?',
      [property_id]
    );
    
    if (propInfo.length === 0) {
      return res.status(404).json({ success: false, message: '房产不存在' });
    }
    
    const [result] = await pool.execute(`
      INSERT INTO deposit_records 
      (community_id, property_id, deposit_type, amount, balance, paid_date, auto_deduct, remark)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [propInfo[0].community_id, property_id, deposit_type, amount, amount, paid_date, auto_deduct, remark]);
    
    res.json({ success: true, data: { id: result.insertId } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 从押金扣费
const deductFromDeposit = async (req, res) => {
  try {
    const { deposit_record_id } = req.params;
    const { deduction_amount, reason, fee_record_id, remark } = req.body;
    
    // 获取押金记录
    const [depositRows] = await pool.execute(
      'SELECT * FROM deposit_records WHERE id = ? AND status = "active"',
      [deposit_record_id]
    );
    
    if (depositRows.length === 0) {
      return res.status(404).json({ success: false, message: '押金记录不存在或已不可用' });
    }
    
    const deposit = depositRows[0];
    
    if (deposit.balance < deduction_amount) {
      return res.status(400).json({ 
        success: false, 
        message: `押金余额不足，当前余额：${deposit.balance}元` 
      });
    }
    
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    
    try {
      // 记录扣费
      await connection.execute(`
        INSERT INTO deposit_deductions 
        (deposit_record_id, fee_record_id, deduction_amount, deduction_date, reason, remark)
        VALUES (?, ?, ?, CURDATE(), ?, ?)
      `, [deposit_record_id, fee_record_id, deduction_amount, reason, remark]);
      
      // 更新押金余额
      const newBalance = deposit.balance - deduction_amount;
      const newStatus = newBalance <= 0 ? 'depleted' : 'active';
      
      await connection.execute(`
        UPDATE deposit_records 
        SET balance = ?, status = ?
        WHERE id = ?
      `, [newBalance, newStatus, deposit_record_id]);
      
      // 如果关联了费用记录，更新费用记录状态
      if (fee_record_id) {
        await connection.execute(`
          UPDATE fee_records 
          SET status = 'paid', paid_date = CURDATE(), paid_amount = ?, payment_method = '押金扣费'
          WHERE id = ?
        `, [deduction_amount, fee_record_id]);
      }
      
      await connection.commit();
      
      res.json({
        success: true,
        message: '押金扣费成功',
        data: {
          deduction_amount: deduction_amount,
          remaining_balance: newBalance,
          status: newStatus
        }
      });
      
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
    
  } catch (error) {
    console.error('押金扣费失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 退还押金
const refundDeposit = async (req, res) => {
  try {
    const { deposit_record_id } = req.params;
    const { refund_amount, remark } = req.body;
    
    const [depositRows] = await pool.execute(
      'SELECT * FROM deposit_records WHERE id = ?',
      [deposit_record_id]
    );
    
    if (depositRows.length === 0) {
      return res.status(404).json({ success: false, message: '押金记录不存在' });
    }
    
    const deposit = depositRows[0];
    
    if (refund_amount > deposit.balance) {
      return res.status(400).json({ 
        success: false, 
        message: `退还金额不能超过余额，当前余额：${deposit.balance}元` 
      });
    }
    
    const [result] = await pool.execute(`
      UPDATE deposit_records 
      SET balance = balance - ?, status = ?, refund_date = CURDATE(), remark = CONCAT(IFNULL(remark, ''), '; ', ?)
      WHERE id = ?
    `, [refund_amount, 'refunded', remark || `退还${refund_amount}元`, deposit_record_id]);
    
    res.json({
      success: true,
      message: '押金退还成功',
      data: {
        refund_amount: refund_amount,
        remaining_balance: deposit.balance - refund_amount
      }
    });
    
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== 每日收入管理 ==========

// 获取每日收入记录
const getDailyIncomeRecords = async (req, res) => {
  try {
    const { community_id, start_date, end_date, income_type } = req.query;
    
    let query = `
      SELECT 
        di.*,
        c.name as community_name,
        p.building, p.unit, p.room
      FROM daily_income di
      LEFT JOIN communities c ON di.community_id = c.id
      LEFT JOIN properties p ON di.property_id = p.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (community_id) {
      query += ' AND di.community_id = ?';
      params.push(community_id);
    }
    
    if (start_date) {
      query += ' AND di.record_date >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      query += ' AND di.record_date <= ?';
      params.push(end_date);
    }
    
    if (income_type) {
      query += ' AND di.income_type = ?';
      params.push(income_type);
    }
    
    query += ' ORDER BY di.record_date DESC, di.created_at DESC';
    
    const [rows] = await pool.execute(query, params);
    
    // 计算统计信息
    const totalAmount = rows.reduce((sum, record) => sum + parseFloat(record.amount), 0);
    const typeStats = {};
    
    rows.forEach(record => {
      if (!typeStats[record.income_type]) {
        typeStats[record.income_type] = { count: 0, amount: 0 };
      }
      typeStats[record.income_type].count++;
      typeStats[record.income_type].amount += parseFloat(record.amount);
    });
    
    res.json({ 
      success: true, 
      data: {
        records: rows,
        statistics: {
          total_records: rows.length,
          total_amount: totalAmount,
          type_breakdown: typeStats
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 添加每日收入记录
const addDailyIncomeRecord = async (req, res) => {
  try {
    const { 
      community_id,
      record_date,
      income_type,
      property_id,
      amount,
      quantity = 1,
      unit_price,
      description,
      collector
    } = req.body;
    
    const calculatedAmount = unit_price ? unit_price * quantity : amount;
    
    const [result] = await pool.execute(`
      INSERT INTO daily_income 
      (community_id, record_date, income_type, property_id, amount, quantity, unit_price, description, collector)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [community_id, record_date, income_type, property_id, calculatedAmount, quantity, unit_price, description, collector]);
    
    res.json({ 
      success: true, 
      data: { 
        id: result.insertId,
        calculated_amount: calculatedAmount
      } 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 门禁卡收费（快捷方式）
const addAccessCardFee = async (req, res) => {
  try {
    const { 
      community_id,
      property_id,
      card_count = 1,
      unit_price = 15,
      collector,
      remark
    } = req.body;
    
    const amount = card_count * unit_price;
    const today = new Date().toISOString().split('T')[0];
    
    // 获取房产信息
    let propertyInfo = '';
    if (property_id) {
      const [propRows] = await pool.execute(
        'SELECT building, unit, room FROM properties WHERE id = ?',
        [property_id]
      );
      if (propRows.length > 0) {
        propertyInfo = `${propRows[0].building}${propRows[0].unit}${propRows[0].room}`;
      }
    }
    
    const description = `门禁卡制作费 ${card_count}张 × ${unit_price}元/张 = ${amount}元${propertyInfo ? ` (${propertyInfo})` : ''}${remark ? ` - ${remark}` : ''}`;
    
    const [result] = await pool.execute(`
      INSERT INTO daily_income 
      (community_id, record_date, income_type, property_id, amount, quantity, unit_price, description, collector)
      VALUES (?, ?, '门禁卡费', ?, ?, ?, ?, ?, ?)
    `, [community_id, today, property_id, amount, card_count, unit_price, description, collector]);
    
    res.json({ 
      success: true, 
      message: '门禁卡收费记录添加成功',
      data: { 
        id: result.insertId,
        amount: amount,
        description: description
      } 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 消防放水费（快捷方式）
const addFireWaterFee = async (req, res) => {
  try {
    const { 
      community_id,
      property_id,
      unit_price = 20,
      collector,
      remark
    } = req.body;
    
    const today = new Date().toISOString().split('T')[0];
    
    // 获取房产信息
    let propertyInfo = '';
    if (property_id) {
      const [propRows] = await pool.execute(
        'SELECT building, unit, room FROM properties WHERE id = ?',
        [property_id]
      );
      if (propRows.length > 0) {
        propertyInfo = `${propRows[0].building}${propRows[0].unit}${propRows[0].room}`;
      }
    }
    
    const description = `消防放水费 ${unit_price}元${propertyInfo ? ` (${propertyInfo})` : ''}${remark ? ` - ${remark}` : ''}`;
    
    const [result] = await pool.execute(`
      INSERT INTO daily_income 
      (community_id, record_date, income_type, property_id, amount, quantity, unit_price, description, collector)
      VALUES (?, ?, '消防放水费', ?, ?, 1, ?, ?, ?)
    `, [community_id, today, property_id, unit_price, unit_price, description, collector]);
    
    res.json({ 
      success: true, 
      message: '消防放水费记录添加成功',
      data: { 
        id: result.insertId,
        amount: unit_price,
        description: description
      } 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== 费用记录管理（通用） ==========

// 获取费用记录
const getFeeRecords = async (req, res) => {
  try {
    const { 
      community_id, 
      owner_id, 
      property_id, 
      fee_item_id, 
      status, 
      start_date, 
      end_date,
      page = 1,
      limit = 50
    } = req.query;
    
    let query = `
      SELECT 
        fr.*,
        c.name as community_name,
        fi.name as fee_item_name, fi.category,
        o.name as owner_name,
        p.building, p.unit, p.room,
        ps.space_number
      FROM fee_records fr
      LEFT JOIN communities c ON fr.community_id = c.id
      LEFT JOIN fee_items fi ON fr.fee_item_id = fi.id
      LEFT JOIN owners o ON fr.owner_id = o.id
      LEFT JOIN properties p ON fr.property_id = p.id
      LEFT JOIN parking_spaces ps ON fr.parking_space_id = ps.id
      WHERE 1=1
    `;
    
    const params = [];
    
    if (community_id) {
      query += ' AND fr.community_id = ?';
      params.push(community_id);
    }
    
    if (owner_id) {
      query += ' AND fr.owner_id = ?';
      params.push(owner_id);
    }
    
    if (property_id) {
      query += ' AND fr.property_id = ?';
      params.push(property_id);
    }
    
    if (fee_item_id) {
      query += ' AND fr.fee_item_id = ?';
      params.push(fee_item_id);
    }
    
    if (status) {
      query += ' AND fr.status = ?';
      params.push(status);
    }
    
    if (start_date) {
      query += ' AND fr.created_at >= ?';
      params.push(start_date);
    }
    
    if (end_date) {
      query += ' AND fr.created_at <= ?';
      params.push(end_date + ' 23:59:59');
    }
    
    // 计算总记录数
    const countQuery = query.replace(/SELECT.*?FROM/, 'SELECT COUNT(*) as total FROM');
    const [countResult] = await pool.execute(countQuery, params);
    const total = countResult[0].total;
    
    // 添加分页和排序
    query += ' ORDER BY fr.created_at DESC, fr.due_date ASC';
    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
    
    const [rows] = await pool.execute(query, params);
    
    // 计算统计信息
    const statsQuery = `
      SELECT 
        COUNT(*) as total_count,
        SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_count,
        SUM(CASE WHEN status = 'unpaid' THEN 1 ELSE 0 END) as unpaid_count,
        SUM(amount) as total_amount,
        SUM(CASE WHEN status = 'paid' THEN paid_amount ELSE 0 END) as paid_amount,
        SUM(CASE WHEN status = 'unpaid' THEN amount ELSE 0 END) as unpaid_amount
      FROM fee_records fr WHERE 1=1 ${community_id ? 'AND fr.community_id = ?' : ''}
      ${owner_id ? 'AND fr.owner_id = ?' : ''}
      ${property_id ? 'AND fr.property_id = ?' : ''}
      ${fee_item_id ? 'AND fr.fee_item_id = ?' : ''}
      ${status ? 'AND fr.status = ?' : ''}
      ${start_date ? 'AND fr.created_at >= ?' : ''}
      ${end_date ? 'AND fr.created_at <= ?' : ''}
    `;
    
    const statsParams = params.slice(0, -2); // 移除分页参数
    const [statsResult] = await pool.execute(statsQuery, statsParams);
    
    res.json({ 
      success: true, 
      data: {
        records: rows,
        pagination: {
          current_page: parseInt(page),
          per_page: parseInt(limit),
          total: total,
          total_pages: Math.ceil(total / parseInt(limit))
        },
        statistics: statsResult[0]
      }
    });
  } catch (error) {
    console.error('获取费用记录失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 更新费用记录状态（缴费）
const updateFeeRecordStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      status, 
      paid_amount, 
      payment_method, 
      discount_amount = 0, 
      late_fee = 0,
      remark 
    } = req.body;
    
    const updateFields = ['status = ?'];
    const updateParams = [status];
    
    if (status === 'paid') {
      updateFields.push('paid_date = CURDATE()');
      
      if (paid_amount !== undefined) {
        updateFields.push('paid_amount = ?');
        updateParams.push(paid_amount);
      }
      
      if (payment_method) {
        updateFields.push('payment_method = ?');
        updateParams.push(payment_method);
      }
      
      if (discount_amount > 0) {
        updateFields.push('discount_amount = ?');
        updateParams.push(discount_amount);
      }
      
      if (late_fee > 0) {
        updateFields.push('late_fee = ?');
        updateParams.push(late_fee);
      }
    }
    
    if (remark) {
      updateFields.push('remark = ?');
      updateParams.push(remark);
    }
    
    updateParams.push(id);
    
    const [result] = await pool.execute(
      `UPDATE fee_records SET ${updateFields.join(', ')} WHERE id = ?`,
      updateParams
    );
    
    if (result.affectedRows === 0) {
      res.status(404).json({ success: false, message: '费用记录不存在' });
    } else {
      res.json({ success: true, message: '费用记录更新成功' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  // 押金管理
  getDepositRecords,
  createDepositRecord,
  deductFromDeposit,
  refundDeposit,
  
  // 每日收入管理
  getDailyIncomeRecords,
  addDailyIncomeRecord,
  addAccessCardFee,
  addFireWaterFee,
  
  // 费用记录管理
  getFeeRecords,
  updateFeeRecordStatus
};