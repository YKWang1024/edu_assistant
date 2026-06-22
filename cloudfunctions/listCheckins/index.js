// 云函数：拉取本家庭的习惯打卡记录
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

async function resolveFamily(openid) {
  const u = await db.collection('users').where({ openid: openid }).get()
  if (!u.data || !u.data.length) return null
  return { user: u.data[0], familyId: u.data[0].familyId, role: u.data[0].familyRole }
}

exports.main = async (event, context) => {
  const openid = cloud.getWXContext().OPENID

  try {
    const { childName, limit } = event
    const ctx = await resolveFamily(openid)

    let cond
    if (ctx && ctx.familyId) cond = _.or([{ familyId: ctx.familyId }, { _openid: openid }])
    else cond = { _openid: openid }

    let query = db.collection('familyCheckins').where(cond)
    if (childName) query = query.where({ childName: childName })

    const res = await query.orderBy('date', 'desc').orderBy('createdAt', 'desc').limit(limit || 100).get()
    return { success: true, data: res.data || [] }
  } catch (err) {
    return { success: false, message: '加载失败', error: err.message }
  }
}
