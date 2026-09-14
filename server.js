const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// الاتصال بـ Supabase باستخدام رابط Connection String
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // مطلوب للاتصال الآمن بـ Supabase
});

// 1. تسجيل وصول شاحنة جديدة
app.post('/api/arrivals', async (req, res) => {
  const { driver_name, residency_id, plate_letters, plate_numbers, destination_country } = req.body;

  if (!driver_name || !residency_id || !plate_letters || !plate_numbers || !destination_country) {
    return res.status(400).json({ error: 'جميع الحقول مطلوبة' });
  }

  try {
    const queryText = `
      INSERT INTO truck_arrivals 
      (driver_name, residency_id, plate_letters, plate_numbers, destination_country, arrival_time, status)
      VALUES ($1, $2, $3, $4, $5, NOW(), 'WAITING')
      RETURNING *;
    `;
    const values = [driver_name, residency_id, plate_letters, plate_numbers, destination_country];
    const result = await pool.query(queryText, values);
    
    res.status(201).json({ message: 'تم تسجيل وصول الشاحنة بنجاح', data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'حدث خطأ أثناء تسجيل الشاحنة' });
  }
});

// 2. جلب قائمة الانتظار حسب الأولوية
app.get('/api/arrivals/queue', async (req, res) => {
  try {
    const queryText = `
      SELECT 
        id,
        driver_name,
        residency_id,
        CONCAT(plate_letters, ' ', plate_numbers) AS full_plate,
        destination_country,
        arrival_time,
        status
      FROM truck_arrivals
      WHERE status = 'WAITING'
      ORDER BY arrival_time ASC;
    `;
    const result = await pool.query(queryText);
    res.status(200).json({ count: result.rowCount, queue: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'حدث خطأ أثناء جلب القائمة' });
  }
});

// 3. تحديث حالة الشاحنة
app.patch('/api/arrivals/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const queryText = `UPDATE truck_arrivals SET status = $1 WHERE id = $2 RETURNING *;`;
    const result = await pool.query(queryText, [status, id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'لم يتم العثور على الشاحنة' });

    res.status(200).json({ message: 'تم التحديث بنجاح', data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'حدث خطأ في التحديث' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
