// 云函数：读取单道错题（供家长跨成员查看题目/课程，绕过集合客户端 ACL）
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
    const { questionId } = event
    if (!questionId) return { success: false, message: '缺少题目 ID' }

    const ctx = await resolveFamily(openid)
    const snap = await db.collection('examQuestions').doc(questionId).get()
    const q = snap.data
    if (!q) return { success: false, message: '题目不存在' }
    if (!canAccess(q, openid, ctx)) return { success: false, message: '无权查看该题目' }

    return { success: true, data: q }
  } catch (err) {
    return { success: false, message: '加载失败', error: err.message }
  }
}
