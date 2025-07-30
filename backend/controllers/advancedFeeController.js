const { pool } = require('../config/database');

// ========== 房产类型收费标准管理 ==========

// 获取所有房产类型收费标准
const getPropertyFeeRates = async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT pfr.*, fi.name as fee_item_name, fi.calculation_method 
      FROM property_fee_rates pfr
      LEFT JOIN fee_items fi ON pfr.fee_item_id = fi.id
      ORDER BY pfr.property_type, fi.name
    `);
    
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('获取房产类型收费标准失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 更新房产类型收费标准
const updatePropertyFeeRate = async (req, res) => {
  try {
    const { property_type, fee_item_id, unit_price } = req.body;
    
    // 先检查是否已存在该记录
    const [existing] = await pool.execute(
      'SELECT id FROM property_fee_rates WHERE property_type = ? AND fee_item_id = ?',
      [property_type, fee_item_id]
    );
    
    if (existing.length > 0) {
      // 更新现有记录
      await pool.execute(
        'UPDATE property_fee_rates SET unit_price = ?, updated_at = CURRENT_TIMESTAMP WHERE property_type = ? AND fee_item_id = ?',
        [unit_price, property_type, fee_item_id]
      );
    } else {
      // 插入新记录
      await pool.execute(
        'INSERT INTO property_fee_rates (property_type, fee_item_id, unit_price) VALUES (?, ?, ?)',
        [property_type, fee_item_id, unit_price]
      );
    }
    
    res.json({ success: true, message: '收费标准更新成功' });
  } catch (error) {
    console.error('更新房产类型收费标准失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== 物业费自动计算 ==========

// 计算某业主的物业费（按时间段）
const calculatePropertyFees = async (req, res) => {
  try {
    const { owner_id, property_id, start_date, end_date } = req.query;
    
    let query = `
      SELECT 
        p.id as property_id,
        p.building, p.unit, p.room, p.area, p.property_type, p.handover_date,
        o.name as owner_name,
        pfr.unit_price as property_fee_rate,
        ps.id as parking_id, ps.space_number,
        pfr2.unit_price as parking_fee_rate
      FROM properties p
      LEFT JOIN owners o ON p.owner_id = o.id
      LEFT JOIN property_fee_rates pfr ON p.property_type = pfr.property_type AND pfr.fee_item_id = 1
      LEFT JOIN parking_spaces ps ON ps.owner_id = o.id
      LEFT JOIN property_fee_rates pfr2 ON pfr2.property_type = '车位' AND pfr2.fee_item_id = 2
      WHERE 1=1
    `;
    
    const params = [];
    if (owner_id) {
      query += ' AND o.id = ?';
      params.push(owner_id);
    }
    if (property_id) {
      query += ' AND p.id = ?';
      params.push(property_id);
    }
    
    const [properties] = await pool.execute(query, params);
    
    const calculations = [];
    
    for (const property of properties) {
      if (!property.handover_date) continue;
      
      const handoverDate = new Date(property.handover_date);
      const periodStart = start_date ? new Date(start_date) : handoverDate;
      const periodEnd = end_date ? new Date(end_date) : new Date();
      
      // 计算月数
      const months = calculateMonthsBetween(periodStart, periodEnd);
      
      // 物业费计算
      const propertyFeeAmount = property.area * (property.property_fee_rate || 0) * months;
      
      // 车位管理费计算
      let parkingFeeAmount = 0;
      if (property.parking_id && property.parking_fee_rate) {
        parkingFeeAmount = property.parking_fee_rate * months;
      }
      
      calculations.push({
        property_id: property.property_id,
        address: `${property.building}${property.unit}${property.room}`,
        area: property.area,
        property_type: property.property_type,
        months: months,
        property_fee: {
          unit_price: property.property_fee_rate || 0,
          amount: propertyFeeAmount
        },
        parking_fee: {
          space_number: property.space_number,
          unit_price: property.parking_fee_rate || 0,
          amount: parkingFeeAmount
        },
        total_amount: propertyFeeAmount + parkingFeeAmount,
        period: {
          start: periodStart.toISOString().split('T')[0],
          end: periodEnd.toISOString().split('T')[0]
        }
      });
    }
    
    res.json({ success: true, data: calculations });
  } catch (error) {
    console.error('计算物业费失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 批量生成物业费账单
const generatePropertyFeeBills = async (req, res) => {
  try {
    const { owner_id, property_id, start_date, end_date, due_date } = req.body;
    
    // 先计算费用
    const calculations = await new Promise((resolve, reject) => {
      // 重用计算逻辑...（为了简化，这里直接调用计算函数的逻辑）
      let query = `
        SELECT 
          p.id as property_id,
          p.building, p.unit, p.room, p.area, p.property_type, p.handover_date,
          o.id as owner_id, o.name as owner_name,
          pfr.unit_price as property_fee_rate,
          ps.id as parking_id, ps.space_number,
          pfr2.unit_price as parking_fee_rate
        FROM properties p
        LEFT JOIN owners o ON p.owner_id = o.id
        LEFT JOIN property_fee_rates pfr ON p.property_type = pfr.property_type AND pfr.fee_item_id = 1
        LEFT JOIN parking_spaces ps ON ps.owner_id = o.id
        LEFT JOIN property_fee_rates pfr2 ON pfr2.property_type = '车位' AND pfr2.fee_item_id = 2
        WHERE 1=1
      `;
      
      const params = [];
      if (owner_id) {
        query += ' AND o.id = ?';
        params.push(owner_id);
      }
      if (property_id) {
        query += ' AND p.id = ?';
        params.push(property_id);
      }
      
      pool.execute(query, params)
        .then(([rows]) => resolve(rows))
        .catch(err => reject(err));
    });
    
    // 生成费用记录
    const insertPromises = [];
    
    for (const property of calculations) {
      if (!property.handover_date) continue;
      
      const handoverDate = new Date(property.handover_date);
      const periodStart = start_date ? new Date(start_date) : handoverDate;
      const periodEnd = end_date ? new Date(end_date) : new Date();
      const months = calculateMonthsBetween(periodStart, periodEnd);
      
      // 物业费记录
      if (property.property_fee_rate > 0) {
        const propertyFeeAmount = property.area * property.property_fee_rate * months;
        insertPromises.push(
          pool.execute(
            `INSERT INTO fee_records (property_id, owner_id, fee_item_id, amount, period_start, period_end, due_date, status)
             VALUES (?, ?, 1, ?, ?, ?, ?, 'unpaid')`,
            [property.property_id, property.owner_id, propertyFeeAmount, 
             periodStart.toISOString().split('T')[0], periodEnd.toISOString().split('T')[0], due_date]
          ).then(([result]) => result.insertId)
        );
      }
      
      // 车位管理费记录
      if (property.parking_id && property.parking_fee_rate > 0) {
        const parkingFeeAmount = property.parking_fee_rate * months;
        insertPromises.push(
          pool.execute(
            `INSERT INTO fee_records (parking_space_id, owner_id, fee_item_id, amount, period_start, period_end, due_date, status)
             VALUES (?, ?, 2, ?, ?, ?, ?, 'unpaid')`,
            [property.parking_id, property.owner_id, parkingFeeAmount,
             periodStart.toISOString().split('T')[0], periodEnd.toISOString().split('T')[0], due_date]
          ).then(([result]) => result.insertId)
        );
      }
    }
    
    await Promise.all(insertPromises);
    
    res.json({ 
      success: true, 
      message: '费用账单生成成功',
      generated_count: insertPromises.length
    });
    
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== 欠费查询 ==========

// 查询业主欠费情况
const getOwnerOutstandingFees = async (req, res) => {
  try {
    const { owner_id } = req.params;
    
    const [rows] = await pool.execute(`
      SELECT 
        fr.*,
        fi.name as fee_item_name,
        p.building, p.unit, p.room,
        ps.space_number,
        o.name as owner_name
      FROM fee_records fr
      LEFT JOIN fee_items fi ON fr.fee_item_id = fi.id
      LEFT JOIN properties p ON fr.property_id = p.id
      LEFT JOIN parking_spaces ps ON fr.parking_space_id = ps.id
      LEFT JOIN owners o ON fr.owner_id = o.id
      WHERE fr.owner_id = ? AND fr.status = 'unpaid'
      ORDER BY fr.due_date ASC
    `, [owner_id]);
    
    const total = rows.reduce((sum, record) => sum + record.amount, 0);
    res.json({ 
      success: true, 
      data: {
        outstanding_records: rows,
        total_outstanding: total,
        count: rows.length
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== 工具函数 ==========

// 计算两个日期之间的月数
function calculateMonthsBetween(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  let months = (end.getFullYear() - start.getFullYear()) * 12;
  months += end.getMonth() - start.getMonth();
  
  // 考虑天数
  if (end.getDate() < start.getDate()) {
    months--;
  }
  
  return Math.max(0, months);
}

module.exports = {
  getPropertyFeeRates,
  updatePropertyFeeRate,
  calculatePropertyFees,
  generatePropertyFeeBills,
  getOwnerOutstandingFees
};