const bcrypt = require('bcryptjs');
const { initDb, dbAsync } = require('./db');

async function seed() {
  console.log('--- Initializing CivicPulse Database Tables ---');
  await initDb();

  console.log('--- Seeding Departments ---');
  const departments = [
    { name: 'Roads & Bridges Department', desc: 'Maintains city thoroughfares, flyovers, potholes and road surface stability.' },
    { name: 'Solid Waste Management', desc: 'Sanitation, municipal waste bins, door-to-door collection, dumping clearance.' },
    { name: 'Water Works & Sewerage Board', desc: 'Water supply pipelines, water contamination, sewer blockages, manholes.' },
    { name: 'Street Lighting & Electrical Division', desc: 'Public streetlights, high-mast lamps, junction poles, electric wiring.' },
    { name: 'Town Planning & Infrastructure', desc: 'Footpaths, pedestrian zones, parks, bus shelters, municipal signage.' },
    { name: 'Public Health & Sanitation', desc: 'Mosquito control, open stagnant drains, bio-waste and animal control.' }
  ];

  for (const dept of departments) {
    const exists = await dbAsync.get('SELECT id FROM Departments WHERE department_name = ?', [dept.name]);
    if (!exists) {
      await dbAsync.run('INSERT INTO Departments (department_name, description) VALUES (?, ?)', [dept.name, dept.desc]);
    }
  }

  console.log('--- Seeding Default Accounts ---');
  const salt = await bcrypt.genSalt(10);
  
  // 1. Admin Account
  const adminEmail = 'admin@civicpulse.gov';
  const adminExists = await dbAsync.get('SELECT id FROM Users WHERE email = ?', [adminEmail]);
  let adminId;
  if (!adminExists) {
    const adminPassHash = await bcrypt.hash('Admin@123', salt);
    const res = await dbAsync.run(
      'INSERT INTO Users (name, email, mobile, password_hash, role) VALUES (?, ?, ?, ?, ?)',
      ['Municipal Commissioner Office', adminEmail, '9876543210', adminPassHash, 'Admin']
    );
    adminId = res.lastID;
    console.log(`Created Admin user: ${adminEmail} (password: Admin@123)`);
  } else {
    adminId = adminExists.id;
  }

  // 2. Demo Citizen Account
  const citizenEmail = 'citizen@civicpulse.org';
  const citizenExists = await dbAsync.get('SELECT id FROM Users WHERE email = ?', [citizenEmail]);
  let citizenId;
  if (!citizenExists) {
    const citPassHash = await bcrypt.hash('Citizen@123', salt);
    const res = await dbAsync.run(
      'INSERT INTO Users (name, email, mobile, password_hash, role) VALUES (?, ?, ?, ?, ?)',
      ['Ramesh Varma', citizenEmail, '9123456780', citPassHash, 'Citizen']
    );
    citizenId = res.lastID;
    console.log(`Created Citizen user: ${citizenEmail} (password: Citizen@123)`);
  } else {
    citizenId = citizenExists.id;
  }

  // 3. Seed Realistic Sample Civic Complaints around Hyderabad
  const count = await dbAsync.get('SELECT COUNT(*) as count FROM Complaints');
  if (count.count === 0) {
    console.log('--- Seeding Realistic Initial Complaints ---');
    
    const sampleIssues = [
      {
        complaint_id: 'CP-2026-10492',
        user_id: citizenId,
        title: 'Dangerous deep pothole near Hitec City Cyber Towers signal',
        category: 'Road Damage',
        description: 'Large crater developed right at the turning near Cyber Towers junction. Multiple two-wheelers skidding during peak morning traffic hours.',
        address: 'Cyber Towers Junction, Hitec City, Hyderabad',
        latitude: 17.4504,
        longitude: 78.3808,
        status: 'In Progress',
        priority: 'High',
        dept_name: 'Roads & Bridges Department',
        image_url: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=800&auto=format&fit=crop&q=80',
        created_offset_days: 3
      },
      {
        complaint_id: 'CP-2026-10381',
        user_id: citizenId,
        title: 'Severe garbage dumping outside Madhapur Metro Station',
        category: 'Garbage Overflow',
        description: 'Municipal dumper bins have not been emptied for 4 days. Waste is spilling over the main pedestrian pavement creating an unbearable stench.',
        address: 'Madhapur Metro Pillar 1642, Hyderabad',
        latitude: 17.4399,
        longitude: 78.3908,
        status: 'Reviewed',
        priority: 'High',
        dept_name: 'Solid Waste Management',
        image_url: 'https://images.unsplash.com/photo-1605600659908-0ef719419d41?w=800&auto=format&fit=crop&q=80',
        created_offset_days: 5
      },
      {
        complaint_id: 'CP-2026-10255',
        user_id: citizenId,
        title: 'High-pressure clean water pipeline leakage on Gachibowli flyover link',
        category: 'Water Leakage',
        description: 'Tons of drinking water gushing onto the road since morning. Low water pressure reported in adjacent residential colonies.',
        address: 'Gachibowli Main Rd, near Bio-Diversity Park, Hyderabad',
        latitude: 17.4326,
        longitude: 78.3670,
        status: 'Assigned',
        priority: 'Critical',
        dept_name: 'Water Works & Sewerage Board',
        image_url: 'https://images.unsplash.com/photo-1541888946425-d0fbb18615f3?w=800&auto=format&fit=crop&q=80',
        created_offset_days: 2
      },
      {
        complaint_id: 'CP-2026-10110',
        user_id: citizenId,
        title: 'Four consecutive streetlights unfunctional at Jubilee Hills Rd 36',
        category: 'Streetlight Failure',
        description: 'Entire stretch is pitch dark after 7 PM causing high risk of pedestrian hit-and-runs and safety concerns for women commuters.',
        address: 'Road No. 36, Jubilee Hills, Hyderabad',
        latitude: 17.4342,
        longitude: 78.4063,
        status: 'Resolved',
        priority: 'Medium',
        dept_name: 'Street Lighting & Electrical Division',
        image_url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=800&auto=format&fit=crop&q=80',
        created_offset_days: 7
      },
      {
        complaint_id: 'CP-2026-10550',
        user_id: citizenId,
        title: 'Open hazardous sewage manhole near Ameerpet Metro lane',
        category: 'Drainage Problems',
        description: 'Manhole cover broken and left completely exposed without any warning barricade or caution cone. Severe hazard.',
        address: 'Ameerpet Main Commercial Road, Hyderabad',
        latitude: 17.4375,
        longitude: 78.4483,
        status: 'Pending',
        priority: 'Critical',
        dept_name: 'Water Works & Sewerage Board',
        image_url: 'https://images.unsplash.com/photo-1584467735871-8e85353a8413?w=800&auto=format&fit=crop&q=80',
        created_offset_days: 1
      },
      {
        complaint_id: 'CP-2026-10612',
        user_id: citizenId,
        title: 'Broken bus stop shelter seating and damaged roof at Begumpet',
        category: 'Public Infrastructure',
        description: 'Glass panel shattered and iron bench collapsed. Commuters have no shade during rain or direct sun.',
        address: 'Begumpet Airport Road Bus Stand, Hyderabad',
        latitude: 17.4448,
        longitude: 78.4659,
        status: 'In Progress',
        priority: 'Low',
        dept_name: 'Town Planning & Infrastructure',
        image_url: 'https://images.unsplash.com/photo-1590674899484-d5640e854abe?w=800&auto=format&fit=crop&q=80',
        created_offset_days: 4
      }
    ];

    for (const item of sampleIssues) {
      const dept = await dbAsync.get('SELECT id FROM Departments WHERE department_name = ?', [item.dept_name]);
      const deptId = dept ? dept.id : null;
      
      const res = await dbAsync.run(`
        INSERT INTO Complaints (
          complaint_id, user_id, title, category, description,
          image_url, address, latitude, longitude, status, priority, department_id,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-${item.created_offset_days} days'))
      `, [
        item.complaint_id, item.user_id, item.title, item.category, item.description,
        item.image_url, item.address, item.latitude, item.longitude, item.status, item.priority, deptId
      ]);

      const cId = res.lastID;

      // Add timeline milestones
      await dbAsync.run(`
        INSERT INTO ComplaintUpdates (complaint_id, admin_id, status, remarks, created_at)
        VALUES (?, ?, 'Pending', 'Grievance lodged by citizen via CivicPulse mobile web portal.', datetime('now', '-${item.created_offset_days} days'))
      `, [cId, null]);

      if (item.status === 'Reviewed' || item.status === 'Assigned' || item.status === 'In Progress' || item.status === 'Resolved') {
        await dbAsync.run(`
          INSERT INTO ComplaintUpdates (complaint_id, admin_id, status, remarks, created_at)
          VALUES (?, ?, 'Reviewed', 'Verified by Municipal Control Room triage officer.', datetime('now', '-${item.created_offset_days - 1} days'))
        `, [cId, adminId]);
      }

      if (item.status === 'Assigned' || item.status === 'In Progress' || item.status === 'Resolved') {
        await dbAsync.run(`
          INSERT INTO ComplaintUpdates (complaint_id, admin_id, status, remarks, created_at)
          VALUES (?, ?, 'Assigned', 'Dispatched work order to field engineering crew.', datetime('now', '-${item.created_offset_days - 1} days'))
        `, [cId, adminId]);
      }

      if (item.status === 'In Progress' || item.status === 'Resolved') {
        await dbAsync.run(`
          INSERT INTO ComplaintUpdates (complaint_id, admin_id, status, remarks, created_at)
          VALUES (?, ?, 'In Progress', 'Crew deployed on ground with repair machinery.', datetime('now', '-${item.created_offset_days - 2} days'))
        `, [cId, adminId]);
      }

      if (item.status === 'Resolved') {
        await dbAsync.run(`
          INSERT INTO ComplaintUpdates (complaint_id, admin_id, status, remarks, resolution_image, created_at)
          VALUES (?, ?, 'Resolved', 'Replaced faulty sodium lamps with high efficiency 120W LED fixtures. Verified luminous test.', 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=800&auto=format&fit=crop&q=80', datetime('now', '-1 days'))
        `, [cId, adminId]);
      }

      // Add a couple of community supports
      await dbAsync.run('INSERT OR IGNORE INTO ComplaintSupports (complaint_id, user_id) VALUES (?, ?)', [cId, citizenId]);
    }

    console.log('Seeded sample complaints successfully.');
  }

  console.log('--- Database Seed Completed Successfully ---');
}

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seed error:', err);
      process.exit(1);
    });
}

module.exports = seed;
