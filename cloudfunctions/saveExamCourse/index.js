// 云函数：保存某道题 AI 生成的讲解课程（家庭成员均可写入缓存）
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

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
    const { questionId, content } = event
    if (!questionId || !content) return { success: false, message: '参数不完整' }

    const ctx = await resolveFamily(openid)
    const snap = await db.collection('examQuestions').doc(questionId).get()
    const q = snap.data
    if (!q) return { success: false, message: '题目不存在' }
    if (!canAccess(q, openid, ctx)) return { success: false, message: '无权操作该题目' }

    await db.collection('examQuestions').doc(questionId).update({
      data: {
        aiCourse: { content: String(content), createdAt: new Date() },
        updatedAt: new Date()
      }
    })

    return { success: true }
  } catch (err) {
    return { success: false, message: '保存课程失败', error: err.message }
  }
}
