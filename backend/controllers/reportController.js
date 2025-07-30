const { pool } = require('../config/database');

// ========== 日报表生成 ==========

// 生成日报表
const getDailyReport = async (req, res) => {
  try {
    const { date } = req.query;
    const reportDate = date || new Date().toISOString().split('T')[0];
    
    // 获取当日收费记录
    const [feeRecords] = await pool.execute(`
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
      WHERE DATE(fr.paid_date) = ? AND fr.status = 'paid'
      ORDER BY fr.paid_date
    `, [reportDate]);
    
    // 获取当日其他收入
    const [dailyIncome] = await pool.execute(`
      SELECT 
        di.*,
        p.building, p.unit, p.room
      FROM daily_income di
      LEFT JOIN properties p ON di.property_id = p.id
      WHERE di.record_date = ?
      ORDER BY di.created_at
    `, [reportDate]);
    
    // 计算统计数据
    const feeTotal = feeRecords.reduce((sum, record) => sum + record.amount, 0);
    const incomeTotal = dailyIncome.reduce((sum, record) => sum + record.amount, 0);
    const grandTotal = feeTotal + incomeTotal;
    
    // 按费用类型分组统计
    const feeByType = {};
    feeRecords.forEach(record => {
      const type = record.fee_item_name;
      if (!feeByType[type]) {
        feeByType[type] = { count: 0, amount: 0, records: [] };
      }
      feeByType[type].count++;
      feeByType[type].amount += record.amount;
      feeByType[type].records.push(record);
    });
    
    const incomeByType = {};
    dailyIncome.forEach(record => {
      const type = record.income_type;
      if (!incomeByType[type]) {
        incomeByType[type] = { count: 0, amount: 0, records: [] };
      }
      incomeByType[type].count++;
      incomeByType[type].amount += record.amount;
      incomeByType[type].records.push(record);
    });
    
    res.json({
      success: true,
      data: {
        report_date: reportDate,
        summary: {
          total_amount: grandTotal,
          fee_amount: feeTotal,
          income_amount: incomeTotal,
          total_transactions: feeRecords.length + dailyIncome.length
        },
        fee_records: feeRecords,
        daily_income: dailyIncome,
        statistics: {
          by_fee_type: feeByType,
          by_income_type: incomeByType
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 生成月报表
const getMonthlyReport = async (req, res) => {
  try {
    const { year, month } = req.query;
    const currentDate = new Date();
    const reportYear = year || currentDate.getFullYear();
    const reportMonth = month || (currentDate.getMonth() + 1);
    
    const startDate = `${reportYear}-${String(reportMonth).padStart(2, '0')}-01`;
    const endDate = new Date(reportYear, reportMonth, 0).toISOString().split('T')[0];
    
    // 获取月度收费记录
    const [monthlyFees] = await pool.execute(`
      SELECT 
        DATE(fr.paid_date) as pay_date,
        fi.name as fee_item_name,
        COUNT(*) as transaction_count,
        SUM(fr.amount) as total_amount
      FROM fee_records fr
      LEFT JOIN fee_items fi ON fr.fee_item_id = fi.id
      WHERE DATE(fr.paid_date) BETWEEN ? AND ? AND fr.status = 'paid'
      GROUP BY DATE(fr.paid_date), fi.name
      ORDER BY DATE(fr.paid_date), fi.name
    `, [startDate, endDate]);
    
    // 获取月度其他收入
    const [monthlyIncome] = await pool.execute(`
      SELECT 
        record_date,
        income_type,
        COUNT(*) as transaction_count,
        SUM(amount) as total_amount
      FROM daily_income
      WHERE record_date BETWEEN ? AND ?
      GROUP BY record_date, income_type
      ORDER BY record_date, income_type
    `, [startDate, endDate]);
    
    res.json({
      success: true,
      data: {
        period: { year: reportYear, month: reportMonth, start_date: startDate, end_date: endDate },
        monthly_fees: monthlyFees,
        monthly_income: monthlyIncome
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 生成季度报表
const getQuarterlyReport = async (req, res) => {
  try {
    const { year, quarter } = req.query;
    const currentDate = new Date();
    const reportYear = year || currentDate.getFullYear();
    const reportQuarter = quarter || Math.ceil((currentDate.getMonth() + 1) / 3);
    
    const startMonth = (reportQuarter - 1) * 3 + 1;
    const endMonth = reportQuarter * 3;
    const startDate = `${reportYear}-${String(startMonth).padStart(2, '0')}-01`;
    const endDate = new Date(reportYear, endMonth, 0).toISOString().split('T')[0];
    
    // 获取季度统计数据
    const [quarterlyStats] = await pool.execute(`
      SELECT 
        DATE_FORMAT(fr.paid_date, '%Y-%m') as month,
        fi.name as fee_item_name,
        COUNT(*) as transaction_count,
        SUM(fr.amount) as total_amount
      FROM fee_records fr
      LEFT JOIN fee_items fi ON fr.fee_item_id = fi.id
      WHERE DATE(fr.paid_date) BETWEEN ? AND ? AND fr.status = 'paid'
      GROUP BY DATE_FORMAT(fr.paid_date, '%Y-%m'), fi.name
      ORDER BY month, fi.name
    `, [startDate, endDate]);
    
    res.json({
      success: true,
      data: {
        period: { year: reportYear, quarter: reportQuarter, start_date: startDate, end_date: endDate },
        quarterly_stats: quarterlyStats
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== 欠费统计信息 ==========

// 获取所有业主欠费统计
const getAllOutstandingFees = async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT 
        o.id as owner_id,
        o.name as owner_name,
        o.phone as owner_phone,
        COUNT(fr.id) as outstanding_count,
        SUM(fr.amount) as total_outstanding,
        GROUP_CONCAT(DISTINCT CONCAT(p.building, p.unit, p.room) SEPARATOR ',') as properties,
        GROUP_CONCAT(DISTINCT ps.space_number SEPARATOR ',') as parking_spaces
      FROM owners o
      LEFT JOIN fee_records fr ON o.id = fr.owner_id AND fr.status = 'unpaid'
      LEFT JOIN properties p ON fr.property_id = p.id
      LEFT JOIN parking_spaces ps ON fr.parking_space_id = ps.id
      WHERE fr.id IS NOT NULL
      GROUP BY o.id, o.name, o.phone
      HAVING total_outstanding > 0
      ORDER BY total_outstanding DESC
    `);
    
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 根据房产获取欠费详情
const getPropertyOutstandingDetails = async (req, res) => {
  try {
    const { property_address } = req.params;
    
    // 先查找房产
    const [building, unit, room] = property_address.split('-');
    const [propertyRows] = await pool.execute(`
      SELECT p.*, o.name as owner_name, o.phone as owner_phone
      FROM properties p
      LEFT JOIN owners o ON p.owner_id = o.id
      WHERE p.building = ? AND p.unit = ? AND p.room = ?
    `, [building, unit, room]);
    
    const property = propertyRows[0];
    
    if (!property) {
      return res.status(404).json({ success: false, message: '房产不存在' });
    }
    
    // 获取该业主的所有欠费（包括其他房产）
    const [rows] = await pool.execute(`
      SELECT 
        fr.*,
        fi.name as fee_item_name,
        p.building, p.unit, p.room,
        ps.space_number,
        CASE 
          WHEN p.id IS NOT NULL THEN CONCAT(p.building, p.unit, p.room)
          WHEN ps.id IS NOT NULL THEN ps.space_number
          ELSE '其他'
        END as location
      FROM fee_records fr
      LEFT JOIN fee_items fi ON fr.fee_item_id = fi.id
      LEFT JOIN properties p ON fr.property_id = p.id
      LEFT JOIN parking_spaces ps ON fr.parking_space_id = ps.id
      WHERE fr.owner_id = ? AND fr.status = 'unpaid'
      ORDER BY fr.due_date ASC
    `, [property.owner_id]);
    
    const total = rows.reduce((sum, record) => sum + record.amount, 0);
    res.json({ 
      success: true, 
      data: {
        property: property,
        outstanding_records: rows,
        total_outstanding: total,
        count: rows.length
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== 欠费看板 ==========

// 欠费查询看板
const getOutstandingDashboard = async (req, res) => {
  try {
    const { search_type, search_value, end_date } = req.query;
    const queryEndDate = end_date || new Date().toISOString().split('T')[0];
    
    let query;
    let params;
    
    if (search_type === 'owner') {
      // 按业主名称查询
      query = `
        SELECT 
          fr.*,
          fi.name as fee_item_name,
          o.name as owner_name,
          o.phone as owner_phone,
          p.building, p.unit, p.room,
          ps.space_number,
          CASE 
            WHEN p.id IS NOT NULL THEN CONCAT(p.building, p.unit, p.room)
            WHEN ps.id IS NOT NULL THEN ps.space_number
            ELSE '其他'
          END as location
        FROM fee_records fr
        LEFT JOIN fee_items fi ON fr.fee_item_id = fi.id
        LEFT JOIN owners o ON fr.owner_id = o.id
        LEFT JOIN properties p ON fr.property_id = p.id
        LEFT JOIN parking_spaces ps ON fr.parking_space_id = ps.id
        WHERE o.name LIKE ? AND fr.status = 'unpaid' AND DATE(fr.due_date) <= ?
        ORDER BY fr.due_date ASC
      `;
      params = [`%${search_value}%`, queryEndDate];
    } else if (search_type === 'property') {
      // 按门牌号查询
      const [building, unit, room] = search_value.split('-');
      query = `
        SELECT 
          fr.*,
          fi.name as fee_item_name,
          o.name as owner_name,
          o.phone as owner_phone,
          p.building, p.unit, p.room,
          ps.space_number,
          CASE 
            WHEN p.id IS NOT NULL THEN CONCAT(p.building, p.unit, p.room)
            WHEN ps.id IS NOT NULL THEN ps.space_number
            ELSE '其他'
          END as location
        FROM fee_records fr
        LEFT JOIN fee_items fi ON fr.fee_item_id = fi.id
        LEFT JOIN owners o ON fr.owner_id = o.id
        LEFT JOIN properties p ON fr.property_id = p.id
        LEFT JOIN parking_spaces ps ON fr.parking_space_id = ps.id
        WHERE p.building = ? AND p.unit = ? AND p.room = ? AND fr.status = 'unpaid' AND DATE(fr.due_date) <= ?
        ORDER BY fr.due_date ASC
      `;
      params = [building, unit, room, queryEndDate];
    } else {
      // 默认查询所有欠费
      query = `
        SELECT 
          fr.*,
          fi.name as fee_item_name,
          o.name as owner_name,
          o.phone as owner_phone,
          p.building, p.unit, p.room,
          ps.space_number,
          CASE 
            WHEN p.id IS NOT NULL THEN CONCAT(p.building, p.unit, p.room)
            WHEN ps.id IS NOT NULL THEN ps.space_number
            ELSE '其他'
          END as location
        FROM fee_records fr
        LEFT JOIN fee_items fi ON fr.fee_item_id = fi.id
        LEFT JOIN owners o ON fr.owner_id = o.id
        LEFT JOIN properties p ON fr.property_id = p.id
        LEFT JOIN parking_spaces ps ON fr.parking_space_id = ps.id
        WHERE fr.status = 'unpaid' AND DATE(fr.due_date) <= ?
        ORDER BY fr.due_date ASC
        LIMIT 100
      `;
      params = [queryEndDate];
    }
    
    const [rows] = await pool.execute(query, params);
    
    // 按月份分组
    const byMonth = {};
    rows.forEach(record => {
      const month = record.due_date.substring(0, 7); // YYYY-MM
      if (!byMonth[month]) {
        byMonth[month] = { count: 0, amount: 0, records: [] };
      }
      byMonth[month].count++;
      byMonth[month].amount += record.amount;
      byMonth[month].records.push(record);
    });
    
    const total = rows.reduce((sum, record) => sum + record.amount, 0);
    
    res.json({
      success: true,
      data: {
        search_criteria: { search_type, search_value, end_date: queryEndDate },
        summary: {
          total_count: rows.length,
          total_amount: total
        },
        records: rows,
        by_month: byMonth
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  // 日报表
  getDailyReport,
  getMonthlyReport,
  getQuarterlyReport,
  
  // 欠费统计
  getAllOutstandingFees,
  getPropertyOutstandingDetails,
  
  // 欠费看板
  getOutstandingDashboard
};