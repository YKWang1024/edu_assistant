// 云函数：读取本家庭「可兑换奖励清单」（REQ-025 积分商城）。全家庭成员可读。
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

    const all = (await db.collection('rewardCatalog').where({ familyId: ctx.familyId }).orderBy('createdAt', 'desc').limit(200).get()).data || []
    const list = all.filter(function (c) { return c && !c.isDeleted })
    return { success: true, data: list }
  } catch (err) {
    return { success: false, message: '加载失败', error: err.message }
  }
}
