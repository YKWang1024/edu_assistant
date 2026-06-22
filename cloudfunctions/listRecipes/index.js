// 云函数：拉取本家庭的菜谱列表
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

async function resolveFamily(openid) {
  const u = await db.collection('users').where({ openid: openid }).get()
  if (!u.data || !u.data.length) return null
  return { user: u.data[0], familyId: u.data[0].familyId, role: u.data[0].familyRole }
}

exports.main = async (event, context) => {
  const openid = cloud.getWXContext().OPENID
  try {
    const ctx = await resolveFamily(openid)
    if (!ctx || !ctx.familyId) return { success: false, message: '用户未注册或未加入家庭', code: 'NO_FAMILY' }

    const res = await db.collection('recipes')
      .where({ familyId: ctx.familyId })
      .orderBy('createdAt', 'desc')
      .limit(1000)
      .get()

    return { success: true, data: res.data || [] }
  } catch (err) {
    return { success: false, message: '加载失败', error: err.message }
  }
}
