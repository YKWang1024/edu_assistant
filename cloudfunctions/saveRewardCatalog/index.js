// 云函数：新增/编辑「可兑换奖励清单」项（REQ-025，家长维护）。仅家长(admin)可操作。
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
    if (ctx.role !== 'admin') return { success: false, message: '只有家长(管理员)可维护兑换清单' }

    const name = String(event.name || '').trim()
    if (!name) return { success: false, message: '奖励名称不能为空' }
    const pointsCost = Math.max(1, Math.floor(Number(event.pointsCost) || 0))
    if (!pointsCost) return { success: false, message: '所需积分需为正整数' }

    const fields = {
      name: name,
      icon: event.icon ? String(event.icon).slice(0, 4) : '🎁',
      pointsCost: pointsCost,
      description: event.description ? String(event.description).slice(0, 200) : '',
      updatedAt: new Date()
    }

    if (event.itemId) {
      const snap = await db.collection('rewardCatalog').doc(event.itemId).get()
      if (!snap || !snap.data || snap.data.familyId !== ctx.familyId) return { success: false, message: '无权编辑该项' }
      await db.collection('rewardCatalog').doc(event.itemId).update({ data: fields })
      return { success: true, data: { _id: event.itemId } }
    }

    const res = await db.collection('rewardCatalog').add({
      data: Object.assign({ familyId: ctx.familyId, isDeleted: false, createdAt: new Date() }, fields)
    })
    return { success: true, data: { _id: res._id } }
  } catch (err) {
    return { success: false, message: '保存失败', error: err.message }
  }
}
