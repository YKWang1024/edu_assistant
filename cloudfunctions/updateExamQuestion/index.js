// 云函数：编辑一道拍照错题(题干/题型/选项/答案/解析/科目)。本人或同家庭可改。
// 仅改内容，不动 status/attempts/复习进度。
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const SUBJECTS = ['语文', '数学', '英语', '科学', '其他']

async function resolveFamily(openid) {
  const u = await db.collection('users').where({ openid: openid }).get()
  if (!u.data || !u.data.length) return null
  return { user: u.data[0], familyId: u.data[0].familyId, role: u.data[0].familyRole }
}

function canAccess(q, openid, ctx) {
  if (!q) return false
  if (q._openid === openid) return true
  if (ctx && ctx.familyId && q.familyId === ctx.familyId) return true
  return false
}

exports.main = async (event, context) => {
  const openid = cloud.getWXContext().OPENID
  try {
    const { questionId, subject, childName, type, stem, options, correctAnswer, analysis, figure } = event
    if (!questionId) return { success: false, message: '缺少题目 ID' }
    if (!stem || !String(stem).trim()) return { success: false, message: '题干不能为空' }

    const ctx = await resolveFamily(openid)
    const snap = await db.collection('examQuestions').doc(questionId).get()
    const q = snap.data
    if (!q) return { success: false, message: '题目不存在' }
    if (!canAccess(q, openid, ctx)) return { success: false, message: '无权编辑该题目' }

    const patch = {
      subject: SUBJECTS.indexOf(subject) >= 0 ? subject : (q.subject || '其他'),
      childName: (childName != null && String(childName).trim()) ? String(childName).trim() : (q.childName || '宝贝'),
      type: (type === 'choice' || type === 'fill' || type === 'other') ? type : 'other',
      stem: String(stem).trim(),
      options: Array.isArray(options) ? options : [],
      correctAnswer: correctAnswer == null ? '' : String(correctAnswer),
      analysis: analysis == null ? '' : String(analysis),
      figure: (figure && typeof figure === 'object') ? figure : (figure === null ? null : q.figure || null),
      updatedAt: new Date()
    }

    await db.collection('examQuestions').doc(questionId).update({ data: patch })
    return { success: true }
  } catch (err) {
    return { success: false, message: '保存失败', error: err.message }
  }
}
