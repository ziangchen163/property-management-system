const { pool } = require('../config/database');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// 配置装修文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads/decoration');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = `decoration_${Date.now()}_${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB限制
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

// ========== 装修许可管理 ==========

// 获取所有装修许可
const getDecorationPermits = async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT 
        dp.*,
        p.building, p.unit, p.room,
        o.name as owner_name,
        o.phone as owner_phone,
        c.name as community_name
      FROM decoration_permits dp
      LEFT JOIN properties p ON dp.property_id = p.id
      LEFT JOIN owners o ON p.owner_id = o.id
      LEFT JOIN communities c ON p.community_id = c.id
      ORDER BY dp.created_at DESC
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 根据房产ID获取欠费信息
const getPropertyOutstandingFees = async (req, res) => {
  try {
    const { property_id } = req.params;
    
    // 获取房产基本信息
    const [propertyRows] = await pool.execute(`
      SELECT 
        p.*,
        o.name as owner_name,
        o.phone as owner_phone,
        c.name as community_name
      FROM properties p
      LEFT JOIN owners o ON p.owner_id = o.id
      LEFT JOIN communities c ON p.community_id = c.id
      WHERE p.id = ?
    `, [property_id]);
    
    const property = propertyRows[0];
    
    if (!property) {
      return res.status(404).json({ success: false, message: '房产不存在' });
    }
    
    // 获取该房产的欠费记录
    const [rows] = await pool.execute(`
      SELECT 
        fr.*,
        fi.name as fee_item_name,
        ps.space_number
      FROM fee_records fr
      LEFT JOIN fee_items fi ON fr.fee_item_id = fi.id
      LEFT JOIN parking_spaces ps ON fr.parking_space_id = ps.id
      WHERE (fr.property_id = ? OR fr.owner_id = ?) AND fr.status = 'unpaid'
      ORDER BY fr.due_date ASC
    `, [property_id, property.owner_id]);
    
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

// 创建装修许可
const createDecorationPermit = async (req, res) => {
  try {
    const { 
      property_id, permit_number, start_date, end_date, 
      contact_person, contact_phone, deposit_amount,
      fees 
    } = req.body;
    
    // 检查许可证编号唯一性
    if (permit_number) {
      const [permitRows] = await pool.execute('SELECT id FROM decoration_permits WHERE permit_number = ?', [permit_number]);
      
      if (permitRows.length > 0) {
        return res.status(400).json({ success: false, message: '装修许可证编号已存在' });
      }
    }
    
    // 创建装修许可
    const [result] = await pool.execute(
      `INSERT INTO decoration_permits 
       (property_id, permit_number, start_date, end_date, contact_person, contact_phone, deposit_amount, fee_records)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [property_id, permit_number, start_date, end_date, contact_person, contact_phone, deposit_amount || 0, JSON.stringify(fees || {})]
    );
    
    const permitId = result.insertId;
          
          // 创建相关费用记录
          if (fees) {
            const feePromises = [];
            
            // 装修押金
            if (fees.deposit && fees.deposit > 0) {
              feePromises.push(
                pool.execute(
                  'INSERT INTO deposit_records (property_id, deposit_type, amount, balance, paid_date, remark) VALUES (?, ?, ?, ?, ?, ?)',
                  [property_id, '装修押金', fees.deposit, fees.deposit, new Date().toISOString().split('T')[0], `装修许可证${permit_number}装修押金`]
                )
              );
            }
            
            // 装修垃圾清运费
            if (fees.decoration_waste && fees.decoration_waste > 0) {
              feePromises.push(
                pool.execute(
                  'INSERT INTO daily_income (record_date, income_type, property_id, amount, description) VALUES (?, ?, ?, ?, ?)',
                  [new Date().toISOString().split('T')[0], '装修垃圾清运费', property_id, fees.decoration_waste, `${permit_number}装修垃圾清运费`]
                )
              );
            }
            
            // 建筑垃圾清运费
            if (fees.construction_waste && fees.construction_waste > 0) {
              feePromises.push(
                pool.execute(
                  'INSERT INTO daily_income (record_date, income_type, property_id, amount, description) VALUES (?, ?, ?, ?, ?)',
                  [new Date().toISOString().split('T')[0], '建筑垃圾清运费', property_id, fees.construction_waste, `${permit_number}建筑垃圾清运费`]
                )
              );
            }
            
            // 消防放水费
            if (fees.fire_test && fees.fire_test > 0) {
              feePromises.push(
                pool.execute(
                  'INSERT INTO daily_income (record_date, income_type, property_id, amount, description) VALUES (?, ?, ?, ?, ?)',
                  [new Date().toISOString().split('T')[0], '消防放水费', property_id, fees.fire_test, `${permit_number}消防放水费`]
                )
              );
            }
            
            // 其他费用
            if (fees.other && fees.other > 0) {
              feePromises.push(
                pool.execute(
                  'INSERT INTO daily_income (record_date, income_type, property_id, amount, description) VALUES (?, ?, ?, ?, ?)',
                  [new Date().toISOString().split('T')[0], '其他', property_id, fees.other, `${permit_number}其他费用`]
                )
              );
            }
            
            try {
              await Promise.all(feePromises);
              res.json({ 
                success: true, 
                data: { id: permitId },
                message: '装修许可创建成功，相关费用已记录'
              });
            } catch (error) {
              console.error('创建费用记录失败:', error);
              res.json({ 
                success: true, 
                data: { id: permitId },
                message: '装修许可创建成功，但部分费用记录失败'
              });
            }
          } else {
            res.json({ success: true, data: { id: permitId } });
          }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 更新装修许可
const updateDecorationPermit = async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      permit_number, start_date, end_date, 
      contact_person, contact_phone, deposit_amount, status 
    } = req.body;
    
    const [result] = await pool.execute(
      `UPDATE decoration_permits 
       SET permit_number=?, start_date=?, end_date=?, contact_person=?, contact_phone=?, deposit_amount=?, status=?, updated_at=CURRENT_TIMESTAMP 
       WHERE id=?`,
      [permit_number, start_date, end_date, contact_person, contact_phone, deposit_amount, status, id]
    );
    
    if (result.affectedRows === 0) {
      res.status(404).json({ success: false, message: '装修许可不存在' });
    } else {
      res.json({ success: true, message: '装修许可更新成功' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 上传装修相关文件
const uploadDecorationFile = async (req, res) => {
  try {
    const { id } = req.params;
    const { file_type } = req.body; // 'permit', 'inspection', 'photos'
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: '请选择要上传的文件' });
    }
    
    const fileUrl = `/uploads/decoration/${req.file.filename}`;
    
    let updateField;
    switch (file_type) {
      case 'permit':
        updateField = 'permit_files';
        break;
      case 'inspection':
        updateField = 'inspection_report';
        break;
      case 'photos':
        updateField = 'decoration_photos';
        break;
      default:
        updateField = 'permit_files';
    }
    
    // 获取现有文件列表
    const [rows] = await pool.execute(`SELECT ${updateField} FROM decoration_permits WHERE id = ?`, [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: '装修许可不存在' });
    }
    
    const row = rows[0];
    let files = [];
    if (row && row[updateField]) {
      try {
        files = JSON.parse(row[updateField]);
      } catch (e) {
        files = [row[updateField]]; // 兼容字符串格式
      }
    }
    
    files.push(fileUrl);
    
    await pool.execute(
      `UPDATE decoration_permits SET ${updateField} = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [JSON.stringify(files), id]
    );
    
    res.json({ 
      success: true, 
      message: '文件上传成功',
      data: { file_url: fileUrl, files: files }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 装修押金退还或转为物业费
const handleDecorationDeposit = async (req, res) => {
  try {
    const { permit_id } = req.params;
    const { action, amount, remark } = req.body; // action: 'refund' or 'convert_to_fee'
    
    // 获取装修许可信息
    const [permitRows] = await pool.execute('SELECT * FROM decoration_permits WHERE id = ?', [permit_id]);
    const permit = permitRows[0];
    
    if (!permit) {
      return res.status(404).json({ success: false, message: '装修许可不存在' });
    }
    
    // 查找对应的押金记录
    const [depositRows] = await pool.execute(
      'SELECT * FROM deposit_records WHERE property_id = ? AND deposit_type = "装修押金" AND status = "active"',
      [permit.property_id]
    );
    
    const deposit = depositRows[0];
    if (!deposit) {
      return res.status(404).json({ success: false, message: '未找到对应的装修押金记录' });
    }
    
    if (action === 'refund') {
      // 退还押金
      await pool.execute(
        'UPDATE deposit_records SET status = "refunded", refund_date = ?, remark = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [new Date().toISOString().split('T')[0], `${deposit.remark || ''} | 退还押金: ${remark || ''}`.trim(), deposit.id]
      );
      res.json({ success: true, message: '装修押金退还成功' });
    } else if (action === 'convert_to_fee') {
      // 转为物业费
      await pool.execute(
        'INSERT INTO fee_records (property_id, fee_item_id, amount, period_start, period_end, status, paid_date, remark) VALUES (?, 1, ?, ?, ?, "paid", ?, ?)',
        [permit.property_id, amount || deposit.balance, 
         new Date().toISOString().split('T')[0], new Date().toISOString().split('T')[0],
         new Date().toISOString().split('T')[0], `装修押金转物业费: ${remark || ''}`]
      );
      
      // 更新押金状态
      try {
        await pool.execute(
          'UPDATE deposit_records SET balance = 0, remark = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [`${deposit.remark || ''} | 转为物业费: ${remark || ''}`.trim(), deposit.id]
        );
      } catch (updateErr) {
        console.error('更新押金记录失败:', updateErr);
      }
      res.json({ success: true, message: '装修押金已转为物业费' });
    } else {
      res.status(400).json({ success: false, message: '无效的操作类型' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getDecorationPermits,
  getPropertyOutstandingFees,
  createDecorationPermit,
  updateDecorationPermit,
  uploadDecorationFile,
  handleDecorationDeposit,
  upload
};