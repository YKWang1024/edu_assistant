// 云函数：删除(软删)习惯定义。仅家长(admin)可操作；历史打卡记录不受影响(familyCheckins 已快照习惯信息)。
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
    if (!ctx || !ctx.familyId) return { success: false, message: '用户未注册或未加入家庭' }
    if (ctx.role !== 'admin') return { success: false, message: '只有家长(管理员)可删除习惯' }
    if (!event.habitId) return { success: false, message: '缺少习惯ID' }

    const snap = await db.collection('habitDefs').doc(event.habitId).get()
    if (!snap || !snap.data || snap.data.familyId !== ctx.familyId) return { success: false, message: '无权删除该习惯' }

    await db.collection('habitDefs').doc(event.habitId).update({ data: { isDeleted: true, deletedAt: new Date() } })
    return { success: true }
  } catch (err) {
    return { success: false, message: '删除失败', error: err.message }
  }
}
