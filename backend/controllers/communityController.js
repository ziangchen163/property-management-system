const { pool } = require('../config/database');

// 获取所有小区
const getCommunities = async (req, res) => {
  try {
    const [rows] = await pool.execute(`
      SELECT c.*, 
             COUNT(DISTINCT p.id) as property_count,
             COUNT(DISTINCT ps.id) as parking_count
      FROM communities c
      LEFT JOIN properties p ON c.id = p.community_id
      LEFT JOIN parking_spaces ps ON c.id = ps.community_id
      GROUP BY c.id
      ORDER BY c.name
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 获取单个小区
const getCommunityById = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.execute(`
      SELECT c.*, 
             COUNT(DISTINCT p.id) as property_count,
             COUNT(DISTINCT ps.id) as parking_count
      FROM communities c
      LEFT JOIN properties p ON c.id = p.community_id
      LEFT JOIN parking_spaces ps ON c.id = ps.community_id
      WHERE c.id = ?
      GROUP BY c.id
    `, [id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: '小区不存在' });
    }
    
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// 创建小区
const createCommunity = async (req, res) => {
  try {
    const { name, address, description } = req.body;
    
    const [result] = await pool.execute(
      'INSERT INTO communities (name, address, description) VALUES (?, ?, ?)',
      [name, address, description]
    );
    
    res.json({ success: true, data: { id: result.insertId } });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ success: false, message: '小区名称已存在' });
    } else {
      res.status(500).json({ success: false, message: error.message });
    }
  }
};

// 更新小区
const updateCommunity = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, address, description } = req.body;
    
    const [result] = await pool.execute(
      'UPDATE communities SET name = ?, address = ?, description = ? WHERE id = ?',
      [name, address, description, id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: '小区不存在' });
    }
    
    res.json({ success: true, message: '小区信息更新成功' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      res.status(400).json({ success: false, message: '小区名称已存在' });
    } else {
      res.status(500).json({ success: false, message: error.message });
    }
  }
};

module.exports = { getCommunities, getCommunityById, createCommunity, updateCommunity };