// 云函数：删除(软删)兑换清单项。仅家长(admin)可操作；已发生的兑换记录不受影响。
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
    if (ctx.role !== 'admin') return { success: false, message: '只有家长(管理员)可删除兑换清单项' }
    if (!event.itemId) return { success: false, message: '缺少项ID' }

    const snap = await db.collection('rewardCatalog').doc(event.itemId).get()
    if (!snap || !snap.data || snap.data.familyId !== ctx.familyId) return { success: false, message: '无权删除该项' }

    await db.collection('rewardCatalog').doc(event.itemId).update({ data: { isDeleted: true, deletedAt: new Date() } })
    return { success: true }
  } catch (err) {
    return { success: false, message: '删除失败', error: err.message }
  }
}
