// 云函数：拉取自动小测错题(家庭维度，按错误次数降序)
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
    let query = db.collection('quizWrong').where(cond)
    if (event.subject) query = query.where({ subject: event.subject })

    const res = await query.limit(1000).get()
    const list = res.data || []
    list.sort(function (a, b) { return (b.count || 1) - (a.count || 1) })
    return { success: true, data: list }
  } catch (err) {
    return { success: false, message: '加载失败', error: err.message }
  }
}
