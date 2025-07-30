const { pool } = require('../config/database');

// ========== 自动欠费计算 ==========

// 计算业主欠费（核心功能）
const calculateOwnerOutstandingFees = async (req, res) => {
  try {
    const { owner_id } = req.params;
    const { as_of_date } = req.query; // 截止到什么日期计算欠费
    const cutoffDate = as_of_date ? new Date(as_of_date) : new Date();
    
    // 获取业主的所有房产和车位
    const [ownerAssets] = await pool.execute(`
      SELECT 
        p.id as property_id,
        p.community_id,
        p.building, p.unit, p.room, p.area, p.handover_date,
        p.property_type_id,
        pt.type_name as property_type_name,
        c.name as community_name,
        ps.id as parking_space_id,
        ps.space_number,
        ps.parking_type_id,
        pkt.type_name as parking_type_name
      FROM properties p
      LEFT JOIN property_types pt ON p.property_type_id = pt.id
      LEFT JOIN communities c ON p.community_id = c.id
      LEFT JOIN parking_spaces ps ON ps.owner_id = p.owner_id AND ps.community_id = p.community_id
      LEFT JOIN parking_types pkt ON ps.parking_type_id = pkt.id
      WHERE p.owner_id = ? AND p.handover_date IS NOT NULL
      ORDER BY c.name, p.building, p.unit, p.room
    `, [owner_id]);
    
    if (ownerAssets.length === 0) {
      return res.json({
        success: true,
        data: {
          owner_id: parseInt(owner_id),
          total_outstanding: 0,
          outstanding_details: [],
          message: '该业主没有已交付的房产'
        }
      });
    }
    
    let totalOutstanding = 0;
    const outstandingDetails = [];
    
    for (const asset of ownerAssets) {
      // 计算物业费欠费
      if (asset.property_id) {
        const propertyFeeDetails = await calculatePropertyFeeOutstanding(
          asset.property_id, 
          asset.community_id, 
          asset.property_type_id, 
          asset.area, 
          asset.handover_date, 
          cutoffDate
        );
        
        if (propertyFeeDetails.outstanding_amount > 0) {
          outstandingDetails.push({
            asset_type: 'property',
            asset_id: asset.property_id,
            asset_description: `${asset.community_name} ${asset.building}${asset.unit}${asset.room}`,
            fee_type: '物业费',
            ...propertyFeeDetails
          });
          totalOutstanding += propertyFeeDetails.outstanding_amount;
        }
      }
      
      // 计算车位管理费欠费
      if (asset.parking_space_id) {
        const parkingFeeDetails = await calculateParkingFeeOutstanding(
          asset.parking_space_id,
          asset.community_id,
          asset.parking_type_id,
          asset.handover_date, // 使用房产交付时间作为车位开始计费时间
          cutoffDate
        );
        
        if (parkingFeeDetails.outstanding_amount > 0) {
          outstandingDetails.push({
            asset_type: 'parking',
            asset_id: asset.parking_space_id,
            asset_description: `${asset.community_name} ${asset.space_number}`,
            fee_type: '保洁能耗费',
            ...parkingFeeDetails
          });
          totalOutstanding += parkingFeeDetails.outstanding_amount;
        }
      }
    }
    
    // 获取已有的未缴费记录（避免重复计算）
    const [existingRecords] = await pool.execute(`
      SELECT 
        fr.property_id, fr.parking_space_id, fr.fee_item_id,
        SUM(fr.amount) as existing_amount,
        fi.name as fee_name
      FROM fee_records fr
      LEFT JOIN fee_items fi ON fr.fee_item_id = fi.id
      WHERE fr.owner_id = ? AND fr.status = 'unpaid'
      GROUP BY fr.property_id, fr.parking_space_id, fr.fee_item_id
    `, [owner_id]);
    
    let existingTotal = 0;
    existingRecords.forEach(record => {
      existingTotal += parseFloat(record.existing_amount);
    });
    
    res.json({
      success: true,
      data: {
        owner_id: parseInt(owner_id),
        calculation_date: cutoffDate.toISOString().split('T')[0],
        calculated_outstanding: totalOutstanding,
        existing_unpaid_records: existingTotal,
        total_outstanding: existingTotal, // 显示实际的欠费记录总额
        outstanding_details: outstandingDetails,
        existing_records: existingRecords
      }
    });
    
  } catch (error) {
    console.error('计算业主欠费失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 计算物业费欠费详情
async function calculatePropertyFeeOutstanding(propertyId, communityId, propertyTypeId, area, handoverDate, cutoffDate) {
  try {
    // 获取物业费收费标准
    const [rateRows] = await pool.execute(`
      SELECT unit_price, effective_date 
      FROM community_fee_rates 
      WHERE community_id = ? AND fee_item_id = 1 AND property_type_id = ? 
        AND effective_date <= ? AND is_active = 1
      ORDER BY effective_date DESC 
      LIMIT 1
    `, [communityId, propertyTypeId, cutoffDate]);
    
    if (rateRows.length === 0) {
      return { outstanding_amount: 0, details: '未设置收费标准' };
    }
    
    const unitPrice = parseFloat(rateRows[0].unit_price);
    const startDate = new Date(handoverDate);
    
    // 计算应收月数
    const totalMonths = calculateMonthsBetween(startDate, cutoffDate);
    if (totalMonths <= 0) {
      return { outstanding_amount: 0, details: '未到计费期' };
    }
    
    // 计算应收总额
    const totalAmount = area * unitPrice * totalMonths;
    
    // 获取已缴费金额
    const [paidRows] = await pool.execute(`
      SELECT COALESCE(SUM(paid_amount), 0) as paid_total
      FROM fee_records 
      WHERE property_id = ? AND fee_item_id = 1 AND status = 'paid'
    `, [propertyId]);
    
    const paidTotal = parseFloat(paidRows[0].paid_total || 0);
    const outstandingAmount = Math.max(0, totalAmount - paidTotal);
    
    return {
      outstanding_amount: outstandingAmount,
      period_start: startDate.toISOString().split('T')[0],
      period_end: cutoffDate.toISOString().split('T')[0],
      total_months: totalMonths,
      unit_price: unitPrice,
      area: area,
      total_should_pay: totalAmount,
      paid_amount: paidTotal,
      details: `${area}㎡ × ${unitPrice}元/㎡/月 × ${totalMonths}月 = ${totalAmount}元，已缴${paidTotal}元`
    };
    
  } catch (error) {
    console.error('计算物业费详情失败:', error);
    return { outstanding_amount: 0, details: '计算错误: ' + error.message };
  }
}

// 计算车位管理费欠费详情
async function calculateParkingFeeOutstanding(parkingSpaceId, communityId, parkingTypeId, startDate, cutoffDate) {
  try {
    // 获取车位管理费收费标准
    const [rateRows] = await pool.execute(`
      SELECT unit_price, effective_date
      FROM community_fee_rates 
      WHERE community_id = ? AND fee_item_id = 2 AND parking_type_id = ?
        AND effective_date <= ? AND is_active = 1
      ORDER BY effective_date DESC 
      LIMIT 1
    `, [communityId, parkingTypeId, cutoffDate]);
    
    if (rateRows.length === 0) {
      return { outstanding_amount: 0, details: '未设置收费标准' };
    }
    
    const unitPrice = parseFloat(rateRows[0].unit_price);
    const calculationStartDate = new Date(startDate);
    
    const totalMonths = calculateMonthsBetween(calculationStartDate, cutoffDate);
    if (totalMonths <= 0) {
      return { outstanding_amount: 0, details: '未到计费期' };
    }
    
    const totalAmount = unitPrice * totalMonths;
    
    // 获取已缴费金额
    const [paidRows] = await pool.execute(`
      SELECT COALESCE(SUM(paid_amount), 0) as paid_total
      FROM fee_records 
      WHERE parking_space_id = ? AND fee_item_id = 2 AND status = 'paid'
    `, [parkingSpaceId]);
    
    const paidTotal = parseFloat(paidRows[0].paid_total || 0);
    const outstandingAmount = Math.max(0, totalAmount - paidTotal);
    
    return {
      outstanding_amount: outstandingAmount,
      period_start: calculationStartDate.toISOString().split('T')[0],
      period_end: cutoffDate.toISOString().split('T')[0],
      total_months: totalMonths,
      unit_price: unitPrice,
      total_should_pay: totalAmount,
      paid_amount: paidTotal,
      details: `${unitPrice}元/月 × ${totalMonths}月 = ${totalAmount}元，已缴${paidTotal}元`
    };
    
  } catch (error) {
    console.error('计算车位管理费详情失败:', error);
    return { outstanding_amount: 0, details: '计算错误: ' + error.message };
  }
}

// ========== 生成欠费账单 ==========

// 为业主生成欠费账单
const generateOutstandingBills = async (req, res) => {
  try {
    const { owner_id } = req.params;
    const { due_date, remark } = req.body;
    
    // 先计算欠费
    const outstandingData = await new Promise((resolve, reject) => {
      calculateOwnerOutstandingFees({ params: { owner_id }, query: {} }, {
        json: (data) => resolve(data.data),
        status: () => ({ json: reject })
      });
    });
    
    if (outstandingData.calculated_outstanding === 0) {
      return res.json({ 
        success: true, 
        message: '该业主暂无欠费',
        generated_count: 0 
      });
    }
    
    const insertPromises = [];
    
    // 为每个欠费项目生成费用记录
    for (const detail of outstandingData.outstanding_details) {
      if (detail.outstanding_amount > 0) {
        const feeItemId = detail.fee_type === '物业费' ? 1 : 2;
        
        const insertData = [
          detail.asset_type === 'property' ? detail.asset_id : null, // property_id
          detail.asset_type === 'parking' ? detail.asset_id : null, // parking_space_id
          owner_id, // owner_id
          feeItemId, // fee_item_id
          detail.outstanding_amount, // amount
          detail.period_start, // period_start
          detail.period_end, // period_end
          due_date || new Date().toISOString().split('T')[0], // due_date
          'unpaid', // status
          remark || '系统自动生成欠费账单' // remark
        ];
        
        // 获取community_id
        let communityId;
        if (detail.asset_type === 'property') {
          const [propRows] = await pool.execute('SELECT community_id FROM properties WHERE id = ?', [detail.asset_id]);
          communityId = propRows[0]?.community_id;
        } else {
          const [parkRows] = await pool.execute('SELECT community_id FROM parking_spaces WHERE id = ?', [detail.asset_id]);
          communityId = parkRows[0]?.community_id;
        }
        
        insertData.unshift(communityId); // 在开头插入community_id
        
        insertPromises.push(
          pool.execute(`
            INSERT INTO fee_records 
            (community_id, property_id, parking_space_id, owner_id, fee_item_id, amount, period_start, period_end, due_date, status, remark)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, insertData)
        );
      }
    }
    
    await Promise.all(insertPromises);
    
    res.json({
      success: true,
      message: '欠费账单生成成功',
      generated_count: insertPromises.length,
      total_amount: outstandingData.calculated_outstanding
    });
    
  } catch (error) {
    console.error('生成欠费账单失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== 批量生成账单 ==========

// 批量为所有业主生成当月账单
const generateMonthlyBills = async (req, res) => {
  try {
    const { community_id, bill_month, due_date } = req.body;
    // bill_month格式: 2024-01
    
    if (!bill_month || !due_date) {
      return res.status(400).json({ 
        success: false, 
        message: '请提供账单月份和到期日期' 
      });
    }
    
    // 获取指定小区的所有已交付房产
    let query = `
      SELECT DISTINCT
        p.id as property_id,
        p.community_id,
        p.owner_id,
        p.area,
        p.property_type_id,
        ps.id as parking_space_id,
        ps.parking_type_id
      FROM properties p
      LEFT JOIN parking_spaces ps ON ps.owner_id = p.owner_id AND ps.community_id = p.community_id
      WHERE p.is_delivered = 1 AND p.handover_date IS NOT NULL
    `;
    
    const params = [];
    if (community_id) {
      query += ' AND p.community_id = ?';
      params.push(community_id);
    }
    
    const [properties] = await pool.execute(query, params);
    
    const billDate = new Date(bill_month + '-01');
    const billYear = billDate.getFullYear();
    const billMonthNum = billDate.getMonth() + 1;
    
    const periodStart = `${billYear}-${billMonthNum.toString().padStart(2, '0')}-01`;
    const lastDay = new Date(billYear, billMonthNum, 0).getDate();
    const periodEnd = `${billYear}-${billMonthNum.toString().padStart(2, '0')}-${lastDay}`;
    
    const insertPromises = [];
    let generatedCount = 0;
    
    for (const prop of properties) {
      // 检查是否已生成该月账单
      const [existingBills] = await pool.execute(`
        SELECT id FROM fee_records 
        WHERE (property_id = ? OR parking_space_id = ?) 
          AND period_start = ? AND period_end = ?
      `, [prop.property_id, prop.parking_space_id, periodStart, periodEnd]);
      
      if (existingBills.length > 0) {
        continue; // 已存在该月账单，跳过
      }
      
      // 生成物业费账单
      if (prop.property_id) {
        const [propertyRates] = await pool.execute(`
          SELECT unit_price FROM community_fee_rates 
          WHERE community_id = ? AND fee_item_id = 1 AND property_type_id = ? 
            AND is_active = 1 AND effective_date <= ?
          ORDER BY effective_date DESC LIMIT 1
        `, [prop.community_id, prop.property_type_id, periodStart]);
        
        if (propertyRates.length > 0) {
          const amount = prop.area * propertyRates[0].unit_price * 1; // 一个月
          
          insertPromises.push(
            pool.execute(`
              INSERT INTO fee_records 
              (community_id, property_id, owner_id, fee_item_id, amount, period_start, period_end, due_date, status, remark)
              VALUES (?, ?, ?, 1, ?, ?, ?, ?, 'unpaid', ?)
            `, [prop.community_id, prop.property_id, prop.owner_id, amount, periodStart, periodEnd, due_date, `${bill_month}月物业费`])
          );
          generatedCount++;
        }
      }
      
      // 生成车位管理费账单
      if (prop.parking_space_id) {
        const [parkingRates] = await pool.execute(`
          SELECT unit_price FROM community_fee_rates 
          WHERE community_id = ? AND fee_item_id = 2 AND parking_type_id = ? 
            AND is_active = 1 AND effective_date <= ?
          ORDER BY effective_date DESC LIMIT 1
        `, [prop.community_id, prop.parking_type_id, periodStart]);
        
        if (parkingRates.length > 0) {
          const amount = parkingRates[0].unit_price * 1; // 一个月
          
          insertPromises.push(
            pool.execute(`
              INSERT INTO fee_records 
              (community_id, parking_space_id, owner_id, fee_item_id, amount, period_start, period_end, due_date, status, remark)
              VALUES (?, ?, ?, 2, ?, ?, ?, ?, 'unpaid', ?)
            `, [prop.community_id, prop.parking_space_id, prop.owner_id, amount, periodStart, periodEnd, due_date, `${bill_month}月车位管理费`])
          );
          generatedCount++;
        }
      }
    }
    
    await Promise.all(insertPromises);
    
    res.json({
      success: true,
      message: `${bill_month}月账单生成成功`,
      generated_count: generatedCount,
      period_start: periodStart,
      period_end: periodEnd
    });
    
  } catch (error) {
    console.error('批量生成月度账单失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== 水电费管理 ==========

// 抄水表并生成费用
const createWaterReading = async (req, res) => {
  try {
    const { 
      property_id, 
      reading_date, 
      current_reading, 
      unit_price = 3.5, 
      reading_type = 'monthly',
      reader,
      remark 
    } = req.body;
    
    // 获取上次读数
    const [lastReading] = await pool.execute(`
      SELECT current_reading 
      FROM water_readings 
      WHERE property_id = ? 
      ORDER BY reading_date DESC 
      LIMIT 1
    `, [property_id]);
    
    const previousReading = lastReading.length > 0 ? lastReading[0].current_reading : 0;
    const usageAmount = Math.max(0, current_reading - previousReading);
    const amount = usageAmount * unit_price;
    
    // 插入抄表记录
    const [result] = await pool.execute(`
      INSERT INTO water_readings 
      (property_id, reading_date, current_reading, previous_reading, unit_price, reading_type, reader, remark)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [property_id, reading_date, current_reading, previousReading, unit_price, reading_type, reader, remark]);
    
    // 如果有用量，生成费用记录
    if (amount > 0) {
      const [propInfo] = await pool.execute(
        'SELECT community_id, owner_id FROM properties WHERE id = ?', 
        [property_id]
      );
      
      if (propInfo.length > 0) {
        await pool.execute(`
          INSERT INTO fee_records 
          (community_id, property_id, owner_id, fee_item_id, amount, due_date, status, remark)
          VALUES (?, ?, ?, 3, ?, DATE_ADD(?, INTERVAL 30 DAY), 'unpaid', ?)
        `, [
          propInfo[0].community_id, 
          property_id, 
          propInfo[0].owner_id, 
          amount, 
          reading_date,
          `${reading_date}抄表，用量${usageAmount}吨`
        ]);
      }
    }
    
    res.json({
      success: true,
      data: {
        reading_id: result.insertId,
        usage_amount: usageAmount,
        amount: amount,
        fee_generated: amount > 0
      }
    });
    
  } catch (error) {
    console.error('抄水表失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 抄电表并生成费用
const createElectricityReading = async (req, res) => {
  try {
    const { 
      property_id, 
      reading_date, 
      current_reading, 
      reading_type = 'monthly',
      prepaid_balance = 0,
      reader,
      remark 
    } = req.body;
    
    // 获取房产信息和电费单价
    const [propInfo] = await pool.execute(`
      SELECT p.community_id, p.owner_id, p.property_type_id, pt.type_name
      FROM properties p
      LEFT JOIN property_types pt ON p.property_type_id = pt.id
      WHERE p.id = ?
    `, [property_id]);
    
    if (propInfo.length === 0) {
      return res.status(404).json({ success: false, message: '房产不存在' });
    }
    
    // 获取电费单价
    const [rateRows] = await pool.execute(`
      SELECT unit_price 
      FROM community_fee_rates 
      WHERE community_id = ? AND fee_item_id = 4 AND property_type_id = ?
        AND is_active = 1 AND effective_date <= ?
      ORDER BY effective_date DESC 
      LIMIT 1
    `, [propInfo[0].community_id, propInfo[0].property_type_id, reading_date]);
    
    if (rateRows.length === 0) {
      return res.status(400).json({ success: false, message: '未设置该房产类型的电费单价' });
    }
    
    const unitPrice = rateRows[0].unit_price;
    
    // 获取上次读数
    const [lastReading] = await pool.execute(`
      SELECT current_reading 
      FROM electricity_readings 
      WHERE property_id = ? 
      ORDER BY reading_date DESC 
      LIMIT 1
    `, [property_id]);
    
    const previousReading = lastReading.length > 0 ? lastReading[0].current_reading : 0;
    const usageAmount = Math.max(0, current_reading - previousReading);
    const amount = usageAmount * unitPrice;
    
    // 插入抄表记录
    const [result] = await pool.execute(`
      INSERT INTO electricity_readings 
      (property_id, reading_date, current_reading, previous_reading, unit_price, reading_type, prepaid_balance, reader, remark)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [property_id, reading_date, current_reading, previousReading, unitPrice, reading_type, prepaid_balance, reader, remark]);
    
    // 生成费用记录
    if (amount > 0) {
      await pool.execute(`
        INSERT INTO fee_records 
        (community_id, property_id, owner_id, fee_item_id, amount, due_date, status, remark)
        VALUES (?, ?, ?, 4, ?, DATE_ADD(?, INTERVAL 30 DAY), 'unpaid', ?)
      `, [
        propInfo[0].community_id, 
        property_id, 
        propInfo[0].owner_id, 
        amount, 
        reading_date,
        `${reading_date}抄表，用量${usageAmount}度，单价${unitPrice}元/度`
      ]);
    }
    
    res.json({
      success: true,
      data: {
        reading_id: result.insertId,
        unit_price: unitPrice,
        usage_amount: usageAmount,
        amount: amount,
        prepaid_balance: prepaid_balance,
        fee_generated: amount > 0
      }
    });
    
  } catch (error) {
    console.error('抄电表失败:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ========== 辅助函数 ==========

// 计算两个日期之间的月数
function calculateMonthsBetween(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  let months = (end.getFullYear() - start.getFullYear()) * 12;
  months += end.getMonth() - start.getMonth();
  
  // 如果结束日期的日数小于开始日期的日数，减去一个月
  if (end.getDate() < start.getDate()) {
    months--;
  }
  
  return Math.max(0, months);
}

module.exports = {
  calculateOwnerOutstandingFees,
  generateOutstandingBills,
  generateMonthlyBills,
  createWaterReading,
  createElectricityReading
};