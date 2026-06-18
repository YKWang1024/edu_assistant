// 云函数：清空自动小测错题(家庭维度)
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

async function resolveFamily(openid) {
  const u = await db.collection('users').where({ openid: openid }).get()
  if (!u.data || !u.data.length) return null
  return { familyId: u.data[0].familyId }
}

exports.main = async (event, context) => {
  const openid = cloud.getWXContext().OPENID
  try {
    const ctx = await resolveFamily(openid)
    const familyId = ctx ? ctx.familyId : null
    const cond = familyId ? _.or([{ familyId: familyId }, { _openid: openid }]) : { _openid: openid }
    const res = await db.collection('quizWrong').where(cond).remove()
    return { success: true, data: { removed: res.stats ? res.stats.removed : 0 } }
  } catch (err) {
    return { success: false, message: '清空失败', error: err.message }
  }
}
