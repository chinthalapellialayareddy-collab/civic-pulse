const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const config = require('../config/env');

const dbPath = path.resolve(config.databasePath);
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to connect to SQLite database:', err.message);
  } else {
    console.log('Connected to SQLite database at:', dbPath);
  }
});

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

function initDb() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Users table
      db.run(`
        CREATE TABLE IF NOT EXISTS Users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          mobile TEXT,
          password_hash TEXT NOT NULL,
          role TEXT CHECK(role IN ('Citizen', 'Admin')) DEFAULT 'Citizen',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Departments table
      db.run(`
        CREATE TABLE IF NOT EXISTS Departments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          department_name TEXT UNIQUE NOT NULL,
          description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Complaints table
      db.run(`
        CREATE TABLE IF NOT EXISTS Complaints (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          complaint_id TEXT UNIQUE NOT NULL,
          user_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          category TEXT NOT NULL,
          description TEXT NOT NULL,
          image_url TEXT,
          address TEXT NOT NULL,
          latitude REAL,
          longitude REAL,
          status TEXT CHECK(status IN ('Pending', 'Reviewed', 'Assigned', 'In Progress', 'Resolved')) DEFAULT 'Pending',
          priority TEXT CHECK(priority IN ('Low', 'Medium', 'High', 'Critical')) DEFAULT 'Medium',
          department_id INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE,
          FOREIGN KEY (department_id) REFERENCES Departments(id) ON DELETE SET NULL
        )
      `);

      // Complaint Updates (Audit & Timeline)
      db.run(`
        CREATE TABLE IF NOT EXISTS ComplaintUpdates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          complaint_id INTEGER NOT NULL,
          admin_id INTEGER,
          status TEXT NOT NULL,
          remarks TEXT,
          resolution_image TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (complaint_id) REFERENCES Complaints(id) ON DELETE CASCADE,
          FOREIGN KEY (admin_id) REFERENCES Users(id) ON DELETE SET NULL
        )
      `);

      // In-app Notifications
      db.run(`
        CREATE TABLE IF NOT EXISTS Notifications (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          message TEXT NOT NULL,
          complaint_id TEXT,
          is_read INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
        )
      `);

      // Citizen Community Support / Upvotes for duplicate/similar issues
      db.run(`
        CREATE TABLE IF NOT EXISTS ComplaintSupports (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          complaint_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(complaint_id, user_id),
          FOREIGN KEY (complaint_id) REFERENCES Complaints(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
        )
      `);

      // Create indexes for quick queries
      db.run(`CREATE INDEX IF NOT EXISTS idx_complaints_user ON Complaints(user_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_complaints_status ON Complaints(status)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_complaints_category ON Complaints(category)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_complaint_id ON Complaints(complaint_id)`);
      db.run(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON Notifications(user_id, is_read)`);

      // Safe column migration for ai_summary
      db.run(`ALTER TABLE Complaints ADD COLUMN ai_summary TEXT`, () => {});

      // Ensure Admin account is configured from environment variables
      bcrypt.hash(config.adminPassword, 10, (err, hash) => {
        if (!err && hash) {
          db.get('SELECT id FROM Users WHERE email = ?', [config.adminEmail], (err, row) => {
            if (!row) {
              db.run(
                'INSERT INTO Users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
                ['Municipal Commissioner Office', config.adminEmail, hash, 'Admin']
              );
            } else {
              db.run(
                'UPDATE Users SET password_hash = ?, role = ? WHERE id = ?',
                [hash, 'Admin', row.id]
              );
            }
          });
        }
      });

      resolve();
    });
  });
}

// Helper wrappers for async/await
const dbAsync = {
  get: (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  }),
  all: (sql, params = []) => new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  }),
  run: (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  })
};

module.exports = {
  db,
  dbAsync,
  initDb
};
