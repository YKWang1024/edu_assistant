// 云函数：编辑一条自动小测错题(主要改正确答案)。本人或同家庭可改。
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

async function resolveFamily(openid) {
  const u = await db.collection('users').where({ openid: openid }).get()
  if (!u.data || !u.data.length) return null
  return { familyId: u.data[0].familyId }
}

exports.main = async (event, context) => {
  const openid = cloud.getWXContext().OPENID
  try {
    const { id, answer } = event
    if (!id) return { success: false, message: '缺少 ID' }
    const ctx = await resolveFamily(openid)

    const snap = await db.collection('quizWrong').doc(id).get()
    const q = snap.data
    if (!q) return { success: false, message: '题目不存在' }
    const sameFamily = ctx && ctx.familyId && q.familyId === ctx.familyId
    if (q._openid !== openid && !sameFamily) return { success: false, message: '无权编辑' }

    await db.collection('quizWrong').doc(id).update({
      data: { answer: answer == null ? q.answer : String(answer), updatedAt: new Date() }
    })
    return { success: true }
  } catch (err) {
    return { success: false, message: '保存失败', error: err.message }
  }
}
