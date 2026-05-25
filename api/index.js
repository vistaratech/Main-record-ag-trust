import express from 'express';
import pg from 'pg';
import cors from 'cors';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const app = express();
app.use(cors());
app.use(express.json({ limit: '100mb' }));

// Database connection configuration
const connectionString = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_9EBoxFjQgZ5U@ep-floral-thunder-aosbcmz9.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require';
const pool = new Pool({
  connectionString,
  max: 20, // Reuse up to 20 database connections for superspeed performance
  idleTimeoutMillis: 30000, // Keep connections alive for 30 seconds for immediate reuse
  connectionTimeoutMillis: 2000, // Return fast if connection times out
  ssl: { rejectUnauthorized: false }
});

// Helper: Convert BIGINT fields to Numbers safely
const parseBigInt = (val) => (val !== null && val !== undefined ? Number(val) : val);

// Helper: SHA-256 Hashing matching browser Web Crypto + SJVPS Salt
const hashPassword = (password) => {
  return crypto.createHash('sha256').update(password + '__sjvps_salt_2024__').digest('hex');
};

// Helper: Generate base64 JWT-like token
const generateToken = (user) => {
  return Buffer.from(JSON.stringify({
    id: user.id,
    email: user.email,
    role: user.role,
    ts: Date.now()
  })).toString('base64');
};

// Helper: Parse base64 token
const decodeToken = (token) => {
  try {
    return JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
  } catch (err) {
    return null;
  }
};

// Authentication Middleware
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) return res.status(401).json({ error: 'Access token required' });
  
  const payload = decodeToken(token);
  if (!payload) return res.status(403).json({ error: 'Invalid or expired token' });
  
  try {
    const { rows } = await pool.query('SELECT * FROM app_users WHERE id = $1', [payload.id]);
    if (rows.length === 0) return res.status(403).json({ error: 'User not found' });
    
    req.user = rows[0];
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Authentication internal error' });
  }
};

// ==================== ROW SERIALIZERS ====================

const mapBusiness = (row) => {
  if (!row) return null;
  return {
    id: parseBigInt(row.id),
    name: row.name,
    ownerId: parseBigInt(row.owner_id),
    createdAt: row.created_at
  };
};

const mapFolder = (row) => {
  if (!row) return null;
  return {
    id: parseBigInt(row.id),
    businessId: parseBigInt(row.business_id),
    name: row.name,
    createdAt: row.created_at
  };
};

const mapRegisterSummary = (row) => {
  if (!row) return null;
  return {
    id: parseBigInt(row.id),
    businessId: parseBigInt(row.business_id),
    folderId: row.folder_id ? parseBigInt(row.folder_id) : undefined,
    name: row.name,
    icon: row.icon,
    iconColor: row.icon_color || undefined,
    category: row.category,
    template: row.template,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    entryCount: row.entry_count || 0,
    lastActivity: row.last_activity || undefined,
    deletedAt: row.deleted_at || undefined
  };
};

const mapColumn = (row) => {
  if (!row) return null;
  return {
    id: parseBigInt(row.id),
    registerId: parseBigInt(row.register_id),
    name: row.name,
    type: row.type,
    position: row.position,
    dropdownOptions: row.dropdown_options || [],
    formula: row.formula || undefined,
    width: row.width || undefined,
    summary: row.summary || undefined,
    linkedTo: row.linked_to || undefined,
    mandatory: !!row.mandatory,
    unique: !!row.unique_col
  };
};

const mapEntry = (row) => {
  if (!row) return null;
  return {
    id: parseBigInt(row.id),
    registerId: parseBigInt(row.register_id),
    rowNumber: row.row_number,
    cells: row.cells || {},
    cellStyles: row.cell_styles || {},
    pageIndex: row.page_index ?? 0,
    createdAt: row.created_at
  };
};

const mapHistory = (row) => {
  if (!row) return null;
  return {
    id: parseBigInt(row.id),
    businessId: parseBigInt(row.business_id),
    action: row.action,
    details: row.details,
    timestamp: row.timestamp,
    userName: row.user_name || undefined,
    userId: row.user_id ? parseBigInt(row.user_id) : undefined,
    userEmail: row.user_email || undefined,
    registerName: row.register_name || undefined,
    registerId: row.register_id ? parseBigInt(row.register_id) : undefined,
    entryId: row.entry_id ? parseBigInt(row.entry_id) : undefined
  };
};

const mapBackup = (row) => {
  if (!row) return null;
  return {
    id: row.id,
    businessId: parseBigInt(row.business_id),
    label: row.label || undefined,
    createdAt: row.created_at,
    sizeBytes: parseBigInt(row.size_bytes),
    data: row.data
  };
};

// ==================== AUTH ROUTES ====================

app.post('/api/auth/ensure-default-admin', async (req, res) => {
  try {
    const { rows } = await pool.query("SELECT * FROM app_users WHERE email = 'admin@sjvps.com'");
    if (rows.length === 0) {
      const defaultAdmin = {
        id: 'moze8q0tkbhvb96',
        name: 'Admin',
        email: 'admin@sjvps.com',
        password_hash: hashPassword('admin'),
        role: 'superadmin',
        status: 'active',
        permissions: { isAdmin: true, canView: true, canEdit: true, canDownload: true }
      };
      await pool.query(`
        INSERT INTO app_users (id, name, email, password_hash, role, status, permissions)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        defaultAdmin.id,
        defaultAdmin.name,
        defaultAdmin.email,
        defaultAdmin.password_hash,
        defaultAdmin.role,
        defaultAdmin.status,
        JSON.stringify(defaultAdmin.permissions)
      ]);
      console.log('Ensured default admin user created successfully.');
    }
    res.json({ message: 'Default admin verified' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to ensure admin: ' + err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
  
  try {
    const { rows } = await pool.query('SELECT * FROM app_users WHERE email = $1', [email]);
    if (rows.length === 0) return res.status(401).json({ error: 'Invalid email or password' });
    
    const user = rows[0];
    const incomingHash = hashPassword(password);
    
    if (user.password_hash !== incomingHash) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Your account is deactivated' });
    }
    
    // Update last login
    await pool.query('UPDATE app_users SET last_login = NOW() WHERE id = $1', [user.id]);
    
    const token = generateToken(user);
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        createdAt: user.created_at,
        lastLogin: new Date().toISOString(),
        permissions: user.permissions
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/admin-login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
  
  try {
    const { rows } = await pool.query('SELECT * FROM app_users WHERE email = $1', [email]);
    if (rows.length === 0) return res.status(401).json({ error: 'Invalid email or password' });
    
    const user = rows[0];
    
    if (user.role !== 'superadmin' && user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized: Admin privileges required' });
    }
    
    const incomingHash = hashPassword(password);
    if (user.password_hash !== incomingHash) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    if (user.status !== 'active') {
      return res.status(403).json({ error: 'Your account is deactivated' });
    }
    
    // Update last login
    await pool.query('UPDATE app_users SET last_login = NOW() WHERE id = $1', [user.id]);
    
    const token = generateToken(user);
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        createdAt: user.created_at,
        lastLogin: new Date().toISOString(),
        permissions: user.permissions
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  const user = req.user;
  res.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      createdAt: user.created_at,
      lastLogin: user.last_login,
      permissions: user.permissions
    }
  });
});

app.get('/api/auth/users', authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM app_users ORDER BY email ASC');
    res.json(rows.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      createdAt: user.created_at,
      lastLogin: user.last_login,
      permissions: user.permissions
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/activity', authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM app_activity ORDER BY timestamp DESC LIMIT 1000');
    res.json(rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      userEmail: row.user_email,
      action: row.action,
      details: row.details,
      timestamp: row.timestamp,
      businessId: row.business_id ? parseBigInt(row.business_id) : undefined,
      registerId: row.register_id ? parseBigInt(row.register_id) : undefined,
      registerName: row.register_name || undefined
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/activity/log', authenticateToken, async (req, res) => {
  const { businessId, action, details, registerId, registerName } = req.body;
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
  
  try {
    await pool.query(`
      INSERT INTO app_activity (id, user_id, user_email, action, details, timestamp, business_id, register_id, register_name)
      VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7, $8)
    `, [
      id,
      req.user.id,
      req.user.email,
      action,
      details,
      businessId ? Number(businessId) : null,
      registerId ? Number(registerId) : null,
      registerName || null
    ]);
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/auth/users/:id/permissions', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { permissions } = req.body;
  
  try {
    await pool.query('UPDATE app_users SET permissions = $1 WHERE id = $2', [JSON.stringify(permissions), id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/users/:id/change-password', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;
  
  if (!password) return res.status(400).json({ error: 'Password required' });
  const hash = hashPassword(password);
  
  try {
    await pool.query('UPDATE app_users SET password_hash = $1 WHERE id = $2', [hash, id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/users', authenticateToken, async (req, res) => {
  // Only superadmin or admin can create users
  if (req.user.role !== 'superadmin' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized: Admin privileges required' });
  }

  const { name, email, password, role } = req.body;
  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'Name, email, password, and role are required' });
  }

  try {
    // Check if email already exists
    const emailCheck = await pool.query('SELECT 1 FROM app_users WHERE email = $1', [email]);
    if (emailCheck.rows.length > 0) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
    const hash = hashPassword(password);
    const defaultPermissions = {
      canView: true,
      canEdit: false,
      canDownload: false,
      isAdmin: false
    };

    await pool.query(`
      INSERT INTO app_users (id, name, email, password_hash, role, status, permissions, created_at)
      VALUES ($1, $2, $3, $4, $5, 'active', $6, NOW())
    `, [id, name, email, hash, role, JSON.stringify(defaultPermissions)]);

    res.json({ success: true, user: { id, name, email, role, status: 'active' } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/auth/users/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { name, role, status } = req.body;
  
  try {
    // Get existing user to preserve fields if not supplied in body
    const { rows } = await pool.query('SELECT * FROM app_users WHERE id = $1', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    
    const finalName = name !== undefined ? name : rows[0].name;
    const finalRole = role !== undefined ? role : rows[0].role;
    const finalStatus = status !== undefined ? status : rows[0].status;
    
    await pool.query('UPDATE app_users SET name = $1, role = $2, status = $3 WHERE id = $4', [finalName, finalRole, finalStatus, id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/auth/users/:id', authenticateToken, async (req, res) => {
  // Only superadmin or admin can delete users
  if (req.user.role !== 'superadmin' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Unauthorized: Admin privileges required' });
  }

  const { id } = req.params;
  if (id === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete yourself' });
  }

  try {
    await pool.query('DELETE FROM app_users WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// App download requests
app.post('/api/auth/download-requests', authenticateToken, async (req, res) => {
  const { registerId, registerName, reason, type, payload } = req.body;
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
  
  try {
    await pool.query(`
      INSERT INTO app_requests (id, user_id, user_name, user_email, register_id, register_name, reason, status, type, payload, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', $8, $9, NOW())
    `, [
      id,
      req.user.id,
      req.user.name,
      req.user.email,
      Number(registerId),
      registerName,
      reason,
      type || 'download',
      JSON.stringify(payload || {})
    ]);
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/download-requests', authenticateToken, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM app_requests ORDER BY created_at DESC');
    res.json(rows.map(row => ({
      id: row.id,
      userId: row.user_id,
      userName: row.user_name,
      userEmail: row.user_email,
      registerId: parseBigInt(row.register_id),
      registerName: row.register_name,
      reason: row.reason,
      status: row.status,
      createdAt: row.created_at,
      respondedAt: row.responded_at || undefined,
      responseNote: row.response_note || undefined,
      type: row.type || 'download',
      payload: row.payload
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/auth/download-requests/:id/respond', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { status, responseNote } = req.body;
  
  try {
    await pool.query(`
      UPDATE app_requests 
      SET status = $1, response_note = $2, responded_at = NOW() 
      WHERE id = $3
    `, [status, responseNote || '', id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ==================== BUSINESS DATA ROUTES ====================

app.get('/api/businesses', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM businesses ORDER BY created_at');
    res.json(rows.map(mapBusiness));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/businesses', async (req, res) => {
  const { name } = req.body;
  const id = Date.now(); // bigint ID matches generateId()
  try {
    await pool.query('INSERT INTO businesses (id, name, owner_id, created_at) VALUES ($1, $2, 1, NOW())', [id, name]);
    res.json({ id, name, ownerId: 1, createdAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/folders', async (req, res) => {
  const { businessId } = req.query;
  try {
    const { rows } = await pool.query('SELECT * FROM folders WHERE business_id = $1 ORDER BY created_at', [Number(businessId)]);
    res.json(rows.map(mapFolder));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/folders', async (req, res) => {
  const { id, businessId, name } = req.body;
  const folderId = id ? Number(id) : Date.now();
  try {
    await pool.query('INSERT INTO folders (id, business_id, name, created_at) VALUES ($1, $2, $3, NOW())', [folderId, Number(businessId), name]);
    res.json({ id: folderId, businessId: Number(businessId), name, createdAt: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/folders/:id', async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  try {
    await pool.query('UPDATE folders SET name = $1 WHERE id = $2', [name, Number(id)]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/folders/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM folders WHERE id = $1', [Number(id)]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ==================== REGISTER ROUTES ====================

app.get('/api/registers', async (req, res) => {
  const { businessId } = req.query;
  try {
    const { rows } = await pool.query('SELECT * FROM registers WHERE business_id = $1 AND deleted_at IS NULL ORDER BY created_at', [Number(businessId)]);
    res.json(rows.map(mapRegisterSummary));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/registers/deleted', async (req, res) => {
  const { businessId } = req.query;
  try {
    const { rows } = await pool.query('SELECT * FROM registers WHERE business_id = $1 AND deleted_at IS NOT NULL ORDER BY deleted_at DESC', [Number(businessId)]);
    res.json(rows.map(mapRegisterSummary));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/registers/:id/columns-only', async (req, res) => {
  const { id } = req.params;
  try {
    const regResult = await pool.query('SELECT * FROM registers WHERE id = $1', [Number(id)]);
    if (regResult.rows.length === 0) return res.status(404).json({ error: 'Register not found' });
    
    const colResult = await pool.query('SELECT * FROM columns WHERE register_id = $1 ORDER BY position', [Number(id)]);
    
    const reg = mapRegisterSummary(regResult.rows[0]);
    reg.columns = colResult.rows.map(mapColumn);
    reg.entries = []; // Empty entries for columns only endpoint
    reg.pages = regResult.rows[0].pages || [];
    reg.sharedWith = regResult.rows[0].shared_with || [];
    reg.deletedItems = regResult.rows[0].deleted_items || [];
    reg.migrationCompleted = regResult.rows[0].migration_completed ?? true;
    
    res.json(reg);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/registers/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const regResult = await pool.query('SELECT * FROM registers WHERE id = $1', [Number(id)]);
    if (regResult.rows.length === 0) return res.status(404).json({ error: 'Register not found' });
    
    const colResult = await pool.query('SELECT * FROM columns WHERE register_id = $1 ORDER BY position', [Number(id)]);
    const entResult = await pool.query('SELECT * FROM entries WHERE register_id = $1 ORDER BY row_number', [Number(id)]);
    
    const reg = mapRegisterSummary(regResult.rows[0]);
    reg.columns = colResult.rows.map(mapColumn);
    reg.entries = entResult.rows.map(mapEntry);
    reg.pages = regResult.rows[0].pages || [];
    reg.sharedWith = regResult.rows[0].shared_with || [];
    reg.deletedItems = regResult.rows[0].deleted_items || [];
    reg.migrationCompleted = regResult.rows[0].migration_completed ?? true;
    
    res.json(reg);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/registers', async (req, res) => {
  const { id, businessId, folderId, name, icon, iconColor, category, template, columns } = req.body;
  const registerId = id ? Number(id) : Date.now();
  const timestamp = new Date().toISOString();
  
  try {
    await pool.query('BEGIN');
    
    // Insert Register
    await pool.query(`
      INSERT INTO registers (
        id, business_id, folder_id, name, icon, icon_color, category, template, 
        created_at, updated_at, entry_count, last_activity, deleted_at, pages, shared_with, deleted_items, migration_completed
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW(), $9, '', NULL, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, TRUE)
    `, [
      registerId,
      Number(businessId),
      folderId ? Number(folderId) : null,
      name,
      icon || 'file-text',
      iconColor || null,
      category || 'general',
      template || name,
      columns && columns.length > 0 ? 10 : 0
    ]);
    
    // Insert Columns
    if (columns && Array.isArray(columns)) {
      for (let i = 0; i < columns.length; i++) {
        const col = columns[i];
        const colId = registerId + i + 1;
        await pool.query(`
          INSERT INTO columns (
            id, register_id, name, type, position, dropdown_options, formula, width, summary, linked_to, mandatory, unique_col
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, [
          colId,
          registerId,
          col.name,
          col.type,
          i,
          JSON.stringify(col.dropdownOptions || []),
          col.formula || null,
          col.width || null,
          col.summary || null,
          col.linkedTo ? JSON.stringify(col.linkedTo) : null,
          !!col.mandatory,
          !!col.unique
        ]);
      }
      
      // Insert 10 default empty entries if columns exist
      for (let i = 0; i < 10; i++) {
        const entryId = registerId + 5000 + i;
        await pool.query(`
          INSERT INTO entries (id, register_id, row_number, cells, cell_styles, page_index, created_at)
          VALUES ($1, $2, $3, '{}'::jsonb, '{}'::jsonb, 0, NOW())
        `, [entryId, registerId, i + 1]);
      }
    }
    
    await pool.query('COMMIT');
    res.json({
      id: registerId,
      businessId: Number(businessId),
      folderId: folderId ? Number(folderId) : undefined,
      name,
      icon: icon || 'file-text',
      iconColor: iconColor || undefined,
      category: category || 'general',
      template: template || name,
      createdAt: timestamp,
      updatedAt: timestamp,
      entryCount: columns && columns.length > 0 ? 10 : 0
    });
  } catch (err) {
    await pool.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  }
});

// Resilient transaction-based Full Save of columns and entries
app.put('/api/registers/:id', async (req, res) => {
  const { id } = req.params;
  const reg = req.body;
  const registerId = Number(id);

  try {
    await pool.query('BEGIN');
    
    // 1. Update Register Metadata
    await pool.query(`
      UPDATE registers
      SET name = $1, icon = $2, icon_color = $3, category = $4, template = $5,
          updated_at = NOW(), entry_count = $6, last_activity = $7, deleted_at = $8,
          pages = $9, shared_with = $10, deleted_items = $11, folder_id = $12
      WHERE id = $13
    `, [
      reg.name,
      reg.icon || 'file-text',
      reg.iconColor || null,
      reg.category || 'general',
      reg.template || reg.name,
      reg.entries ? reg.entries.length : 0,
      reg.lastActivity || '',
      reg.deletedAt || null,
      JSON.stringify(reg.pages || []),
      JSON.stringify(reg.sharedWith || []),
      JSON.stringify(reg.deletedItems || []),
      reg.folderId ? Number(reg.folderId) : null,
      registerId
    ]);

    // 2. Overwrite Columns
    if (reg.columns && Array.isArray(reg.columns)) {
      await pool.query('DELETE FROM columns WHERE register_id = $1', [registerId]);
      for (const col of reg.columns) {
        await pool.query(`
          INSERT INTO columns (
            id, register_id, name, type, position, dropdown_options, formula, width, summary, linked_to, mandatory, unique_col
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, [
          Number(col.id),
          registerId,
          col.name,
          col.type,
          col.position ?? 0,
          JSON.stringify(col.dropdownOptions || []),
          col.formula || null,
          col.width || null,
          col.summary || null,
          col.linkedTo ? JSON.stringify(col.linkedTo) : null,
          !!col.mandatory,
          !!col.unique
        ]);
      }
    }

    // 3. Overwrite Entries (spreadsheet rows)
    if (reg.entries && Array.isArray(reg.entries)) {
      await pool.query('DELETE FROM entries WHERE register_id = $1', [registerId]);
      for (const entry of reg.entries) {
        await pool.query(`
          INSERT INTO entries (id, register_id, row_number, cells, cell_styles, page_index, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          Number(entry.id),
          registerId,
          Number(entry.rowNumber),
          JSON.stringify(entry.cells || {}),
          JSON.stringify(entry.cellStyles || {}),
          Number(entry.pageIndex ?? 0),
          entry.createdAt || new Date().toISOString()
        ]);
      }
    }

    await pool.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await pool.query('ROLLBACK');
    res.status(500).json({ error: 'Failed to update register: ' + err.message });
  }
});

// Lightweight single-entry cell update — avoids rewriting the entire register
app.patch('/api/entries/:id', async (req, res) => {
  const { id } = req.params;
  const { cells, cellStyles, registerId } = req.body;
  try {
    // Merge cells into existing entry (JSONB || merges, with new keys overwriting old)
    const updates = [];
    const params = [];
    let paramIdx = 1;

    if (cells && typeof cells === 'object') {
      updates.push(`cells = cells || $${paramIdx}::jsonb`);
      params.push(JSON.stringify(cells));
      paramIdx++;
    }
    if (cellStyles && typeof cellStyles === 'object') {
      updates.push(`cell_styles = cell_styles || $${paramIdx}::jsonb`);
      params.push(JSON.stringify(cellStyles));
      paramIdx++;
    }

    if (updates.length === 0) {
      return res.json({ success: true });
    }

    params.push(Number(id));
    await pool.query(
      `UPDATE entries SET ${updates.join(', ')} WHERE id = $${paramIdx}`,
      params
    );

    // Update register's updated_at timestamp
    if (registerId) {
      await pool.query(
        'UPDATE registers SET updated_at = NOW() WHERE id = $1',
        [Number(registerId)]
      );
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/registers/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('BEGIN');
    await pool.query('DELETE FROM columns WHERE register_id = $1', [Number(id)]);
    await pool.query('DELETE FROM entries WHERE register_id = $1', [Number(id)]);
    await pool.query('DELETE FROM registers WHERE id = $1', [Number(id)]);
    await pool.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await pool.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  }
});


// ==================== HISTORY ROUTES ====================

app.get('/api/history', async (req, res) => {
  const { businessId } = req.query;
  try {
    const { rows } = await pool.query('SELECT * FROM history WHERE business_id = $1 ORDER BY timestamp DESC LIMIT 500', [Number(businessId)]);
    res.json(rows.map(mapHistory));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/history/row', async (req, res) => {
  const { registerId, entryId } = req.query;
  try {
    const { rows } = await pool.query('SELECT * FROM history WHERE register_id = $1 AND entry_id = $2 ORDER BY timestamp DESC', [Number(registerId), Number(entryId)]);
    res.json(rows.map(mapHistory));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/history', async (req, res) => {
  const h = req.body;
  const id = Date.now();
  try {
    await pool.query(`
      INSERT INTO history (
        id, business_id, action, details, timestamp, user_name, user_id, user_email, register_name, register_id, entry_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `, [
      id,
      Number(h.businessId),
      h.action,
      h.details,
      h.timestamp || new Date().toISOString(),
      h.userName || null,
      h.userId ? h.userId.toString() : null,
      h.userEmail || null,
      h.registerName || null,
      h.registerId ? Number(h.registerId) : null,
      h.entryId ? Number(h.entryId) : null
    ]);
    res.json({ success: true, id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// ==================== BACKUP ROUTES ====================

app.get('/api/backups', async (req, res) => {
  const { businessId } = req.query;
  try {
    const { rows } = await pool.query(`
      SELECT data->'meta' AS meta 
      FROM backups 
      WHERE business_id = $1 
      ORDER BY created_at DESC
    `, [Number(businessId)]);
    res.json(rows.map(row => row.meta).filter(Boolean));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/backups/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query('SELECT * FROM backups WHERE id = $1', [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Backup not found' });
    res.json(mapBackup(rows[0]));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/backups', async (req, res) => {
  const { id, businessId, label, sizeBytes, data } = req.body;
  try {
    await pool.query(`
      INSERT INTO backups (id, business_id, label, size_bytes, data, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
    `, [
      id,
      Number(businessId),
      label || '',
      Number(sizeBytes || 0),
      JSON.stringify(data || {})
    ]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/backups/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM backups WHERE id = $1', [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', time: new Date().toISOString() });
});

const PORT = process.env.PORT || 3001;
if (process.env.VERCEL_ENV !== 'production' && process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

export default app;