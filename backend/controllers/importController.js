const XLSX = require('xlsx');
const { pool } = require('../config/database');

// 导入业主数据
const importOwners = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: '请上传Excel文件' });
    }

    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    console.log('Excel数据:', data);

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    // 准备SQL语句
    const insertSQL = `
      INSERT INTO owners (name, phone, id_card, company, position, hobby, remark) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      
      try {
        // 字段映射 - 支持中英文字段名
        const name = row['姓名'] || row['name'] || row['Name'] || row['业主姓名'];
        const phone = row['电话'] || row['phone'] || row['Phone'] || row['联系电话'] || row['手机号'];
        const idCard = row['身份证'] || row['id_card'] || row['IdCard'] || row['身份证号'];
        const company = row['工作单位'] || row['company'] || row['Company'] || row['单位'];
        const position = row['职务'] || row['position'] || row['Position'] || row['职位'];
        const hobby = row['爱好'] || row['hobby'] || row['Hobby'] || row['兴趣爱好'];
        const remark = row['备注'] || row['remark'] || row['Remark'] || row['说明'];

        if (!name) {
          errors.push(`第${i + 2}行：缺少姓名字段`);
          errorCount++;
          continue;
        }

        const [result] = await pool.execute(insertSQL, [
          name,
          phone || null,
          idCard || null,
          company || null,
          position || null,
          hobby || null,
          remark || null
        ]);
        
        successCount++;

      } catch (error) {
        // 检查是否是重复数据错误
        if (error.message.includes('Duplicate entry')) {
          if (error.message.includes('phone')) {
            errors.push(`第${i + 2}行：电话号码 ${phone} 已存在`);
          } else if (error.message.includes('id_card')) {
            errors.push(`第${i + 2}行：身份证号 ${idCard} 已存在`);
          } else {
            errors.push(`第${i + 2}行：数据重复`);
          }
        } else {
          errors.push(`第${i + 2}行：${error.message}`);
        }
        errorCount++;
      }
    }

    // 删除临时文件
    const fs = require('fs');
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      message: `导入完成！成功 ${successCount} 条，失败 ${errorCount} 条`,
      data: {
        total: data.length,
        successCount,
        errorCount,
        errors: errors.slice(0, 10) // 只返回前10个错误
      }
    });

  } catch (error) {
    console.error('导入业主数据失败:', error);
    res.status(500).json({ success: false, message: '导入失败: ' + error.message });
  }
};

// 导入房产数据
const importProperties = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: '请上传Excel文件' });
    }

    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    // 准备SQL语句
    const insertSQL = `
      INSERT INTO properties (
        community_id, property_type, building, unit, room, area, 
        is_delivered, is_decorated, occupancy_status, is_for_rent, 
        handover_date, owner_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    // 获取业主名称到ID的映射
    const getOwnerIdSQL = 'SELECT id FROM owners WHERE name = ? LIMIT 1';

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      
      try {
        // 字段映射
        const building = row['楼栋'] || row['building'] || row['Building'] || row['栋'];
        const unit = row['单元'] || row['unit'] || row['Unit'] || row['单元号'];
        const room = row['房号'] || row['room'] || row['Room'] || row['门牌号'];
        const area = parseFloat(row['面积'] || row['area'] || row['Area'] || row['建筑面积']) || 0;
        const propertyType = row['房产性质'] || row['property_type'] || row['PropertyType'] || '普通住宅';
        const ownerName = row['业主'] || row['owner'] || row['Owner'] || row['业主姓名'];
        const communityId = 1; // 默认小区ID，可以根据需要修改

        if (!building || !unit || !room) {
          errors.push(`第${i + 2}行：缺少必要字段(楼栋/单元/房号)`);
          errorCount++;
          continue;
        }

        if (area <= 0) {
          errors.push(`第${i + 2}行：面积必须大于0`);
          errorCount++;
          continue;
        }

        // 查找业主ID
        let ownerId = null;
        if (ownerName) {
          const [ownerRows] = await pool.execute(getOwnerIdSQL, [ownerName]);
          ownerId = ownerRows.length > 0 ? ownerRows[0].id : null;

          if (!ownerId) {
            errors.push(`第${i + 2}行：未找到业主 ${ownerName}`);
            errorCount++;
            continue;
          }
        }

        const [result] = await pool.execute(insertSQL, [
          communityId,
          propertyType,
          building,
          unit,
          room,
          area,
          1, // is_delivered
          0, // is_decorated
          '空关', // occupancy_status
          0, // is_for_rent
          null, // handover_date
          ownerId
        ]);
        
        successCount++;

      } catch (error) {
        errors.push(`第${i + 2}行：${error.message}`);
        errorCount++;
      }
    }

    // 删除临时文件
    const fs = require('fs');
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      message: `导入完成！成功 ${successCount} 条，失败 ${errorCount} 条`,
      data: {
        total: data.length,
        successCount,
        errorCount,
        errors: errors.slice(0, 10)
      }
    });

  } catch (error) {
    console.error('导入房产数据失败:', error);
    res.status(500).json({ success: false, message: '导入失败: ' + error.message });
  }
};

// 导入车位数据
const importParkingSpaces = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: '请上传Excel文件' });
    }

    const workbook = XLSX.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    // 准备SQL语句
    const insertSQL = `
      INSERT INTO parking_spaces (
        community_id, space_number, type, status, owner_id, location_description
      ) VALUES (?, ?, ?, ?, ?, ?)
    `;

    // 获取业主名称到ID的映射
    const getOwnerIdSQL = 'SELECT id FROM owners WHERE name = ? LIMIT 1';

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      
      try {
        // 字段映射
        const spaceNumber = row['车位编号'] || row['space_number'] || row['SpaceNumber'] || row['编号'];
        const type = row['类型'] || row['type'] || row['Type'] || '地下';
        const status = row['状态'] || row['status'] || row['Status'] || '自用';
        const ownerName = row['业主'] || row['owner'] || row['Owner'] || row['业主姓名'];
        const locationDescription = row['位置描述'] || row['location'] || row['Location'] || row['位置'];
        const communityId = 1; // 默认小区ID

        if (!spaceNumber) {
          errors.push(`第${i + 2}行：缺少车位编号`);
          errorCount++;
          continue;
        }

        // 查找业主ID
        let ownerId = null;
        if (ownerName) {
          const [ownerRows] = await pool.execute(getOwnerIdSQL, [ownerName]);
          ownerId = ownerRows.length > 0 ? ownerRows[0].id : null;

          if (!ownerId) {
            errors.push(`第${i + 2}行：未找到业主 ${ownerName}`);
            errorCount++;
            continue;
          }
        }

        const [result] = await pool.execute(insertSQL, [
          communityId,
          spaceNumber,
          type,
          status,
          ownerId,
          locationDescription
        ]);
        
        successCount++;

      } catch (error) {
        errors.push(`第${i + 2}行：${error.message}`);
        errorCount++;
      }
    }

    // 删除临时文件
    const fs = require('fs');
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      message: `导入完成！成功 ${successCount} 条，失败 ${errorCount} 条`,
      data: {
        total: data.length,
        successCount,
        errorCount,
        errors: errors.slice(0, 10)
      }
    });

  } catch (error) {
    console.error('导入车位数据失败:', error);
    res.status(500).json({ success: false, message: '导入失败: ' + error.message });
  }
};

// 获取导入模板
const getTemplate = (req, res) => {
  const { type } = req.params;
  
  let templateData = [];
  let filename = '';
  
  switch (type) {
    case 'owners':
      templateData = [
        {
          '姓名': '张三',
          '电话': '13800138000',
          '身份证': '110101199001011234',
          '工作单位': '北京科技有限公司',
          '职务': '工程师',
          '爱好': '阅读,运动',
          '备注': '示例数据'
        }
      ];
      filename = '业主导入模板.xlsx';
      break;
      
    case 'properties':
      templateData = [
        {
          '楼栋': 'A栋',
          '单元': '1单元',
          '房号': '101',
          '面积': 85.5,
          '房产性质': '普通住宅',
          '业主': '张三'
        }
      ];
      filename = '房产导入模板.xlsx';
      break;
      
    case 'parking':
      templateData = [
        {
          '车位编号': 'B1-001',
          '类型': '地下',
          '状态': '自用',
          '业主': '张三',
          '位置描述': '地下一层B区，靠近电梯'
        }
      ];
      filename = '车位导入模板.xlsx';
      break;
      
    default:
      return res.status(400).json({ success: false, message: '无效的模板类型' });
  }
  
  // 创建Excel文件
  const worksheet = XLSX.utils.json_to_sheet(templateData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  
  // 设置响应头
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
  
  // 发送文件
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  res.send(buffer);
};

module.exports = {
  importOwners,
  importProperties,
  importParkingSpaces,
  getTemplate
};