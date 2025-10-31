import { pool } from "./database.js";
import { hashPassword} from './encryption.js';



export async function getUserData(req, res) {
  const client = await pool.connect();
  try {
    const userId = req.user.id; // จาก token


    if (!userId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const result = await client.query(`
      SELECT id, username, name, surname, tel, sex, birthday, email, point
      FROM users
      WHERE id = $1
    `, [userId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const user = result.rows[0];

    res.json({ success: true, user });

  } catch (err) {
    console.error('Error getting user data:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
  finally {
    client.release();
  }
}







export async function getLeaderboard(req, res) {
  const userId = req.user?.id; // ต้องมี middleware auth ก่อนหน้านี้
  const client = await pool.connect();

  try {
    // ดึง top 7
    const topUsersResult = await client.query(`
      SELECT id, username, point, RANK() OVER (ORDER BY point DESC) AS rank
      FROM users
      ORDER BY point DESC
      LIMIT 7
    `);

    const topUsers = topUsersResult.rows;

    // ดึง rank ของ user ปัจจุบัน
    let userRankResult = await client.query(`
      SELECT id, username, point, rank FROM (
        SELECT id, username, point, RANK() OVER (ORDER BY point DESC) AS rank
        FROM users
      ) AS ranked
      WHERE id = $1
    `, [userId]);

    const currentUser = userRankResult.rows[0];

    res.json({
      success: true,
      leaderboard: topUsers,
      current_user: currentUser || null
    });

  } catch (err) {
    console.error("Leaderboard error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  } finally {
    client.release();
  }
}






export async function updateUserStageProgress(req, res) {
  const { user_id, stage_id } = req.body;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ตรวจสอบ stage ปัจจุบันที่เคยบันทึกไว้
    const existing = await client.query(
      `SELECT last_stage_id FROM user_stage_progress WHERE user_id = $1`,
      [user_id]
    );

    let shouldUpdate = true;
    if (existing.rowCount > 0) {
      const currentStage = existing.rows[0].last_stage_id;

      if (stage_id <= currentStage) {
        shouldUpdate = false;
      }
    }

    if (!shouldUpdate) {
      await client.query("ROLLBACK");
      return res.json({ success: false, message: "Stage is not newer than current progress" });
    }

    // บันทึกหรืออัปเดต stage ที่ใหม่กว่า
    await client.query(
      `
      INSERT INTO user_stage_progress (user_id, last_stage_id)
      VALUES ($1, $2)
      ON CONFLICT (user_id)
      DO UPDATE SET last_stage_id = EXCLUDED.last_stage_id
      `,
      [user_id, stage_id]
    );

    await client.query(
      `
      UPDATE users
      SET point = COALESCE(point, 0) + 20
      WHERE id = $1
      `,
      [user_id]
    );

    await client.query("COMMIT");

    res.json({ success: true, message: "Progress updated and point added" });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error('Error updating progress:', err);
    res.status(500).json({ success: false, message: 'Internal server error' });
  } finally {
    client.release();
  }
}


export async function getUserStageProgress(req, res) {
  const user_id = parseInt(req.params.user_id);
  const client = await pool.connect();

  try {
    const result = await client.query(`
      SELECT 
        usp.last_stage_id, 
        s.chapter_number, 
        s.stage_number, 
        s.title
      FROM user_stage_progress usp
      JOIN stages s ON usp.last_stage_id = s.id
      WHERE usp.user_id = $1
      ORDER BY s.chapter_number DESC, s.stage_number DESC
      LIMIT 1
    `, [user_id]);

    if (result.rowCount === 0) {
      return res.json({ success: true, progress: null });
    }

    res.json({ success: true, progress: result.rows[0] });

  } catch (err) {
    console.error('Error fetching user stage progress:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  } finally {
    client.release();
  }
}





export async function UpdateProfile(req, res) {
  const client = await pool.connect();

  try {
    const userId = req.user.id; // ดึงจาก token ที่ผ่าน authenticateToken
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // ดึงข้อมูลจาก request body
    const { username, name, surname, tel, sex, birthday, email, password } = req.body;

    // ตรวจสอบว่าข้อมูลที่จำเป็นครบหรือไม่
    if (!name || !surname || !tel || !sex || !birthday || !email) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }
    let newHashed = undefined;
    if (password) {
      newHashed = await hashPassword(password);
    }

    let query = `
  UPDATE users
  SET username = $1,
      name = $2,
      surname = $3,
      tel = $4,
      sex = $5,
      birthday = $6,
      email = $7
`;

    const params = [username, name, surname, tel, sex, birthday, email];

    if (newHashed) {
      query += `, password = $8`;
      params.push(newHashed);
    }

    query += ` WHERE id = $${params.length + 1}`;
    params.push(userId);

    await client.query(query, params);


    res.json({ success: true, message: "Profile updated successfully" });

  } catch (err) {
    console.error("Error updating user profile:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  } finally {
    client.release();
  }
}