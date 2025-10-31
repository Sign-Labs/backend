import {pool} from '../database.js';

/**
 * @param {Object} lessonData - ข้อมูลบทเรียน
 * @param {String} lessonData.title
 * @param {String} lessonData.description
 * @param {Array} lessonData.questions - รายการคำถามแต่ละข้อ
 */
export async function insertLessonWithQuestions(lessonData) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Insert Lesson
    const lessonResult = await client.query(
      `INSERT INTO lessons (title, description) VALUES ($1, $2) RETURNING id`,
      [lessonData.title, lessonData.description]
    );
    const lessonId = lessonResult.rows[0].id;

    // 2. Insert Questions + Choices
    for (const q of lessonData.questions) {
      const questionResult = await client.query(
        `INSERT INTO questions (lesson_id, question_text, image_url)
         VALUES ($1, $2, $3) RETURNING id`,
        [lessonId, q.question_text, q.image_url || null]
      );
      const questionId = questionResult.rows[0].id;

      for (const c of q.choices) {
        await client.query(
          `INSERT INTO choices (question_id, choice_text, image_url, is_correct)
           VALUES ($1, $2, $3, $4)`,
          [questionId, c.choice_text, c.image_url || null, c.is_correct]
        );
      }
    }

    await client.query('COMMIT');
    return { success: true, lessonId };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Insert lesson error:', error);
    throw error;
  } finally {
    client.release();
  }
}