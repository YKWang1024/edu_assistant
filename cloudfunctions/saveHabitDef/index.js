// 云函数：新增/编辑习惯定义（REQ-023 自定义习惯 + REQ-024 奖励类型配置）
// 仅家长(admin)可配置——REQ-024 验收#0「奖励规则由家长在家长侧配置/审批」，本实现把整个
// 习惯定义(含名称/目标/周期/奖励类型与数值)都收在家长侧统一管理，非家长只读。
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const REWARD_TYPES = ['time', 'money', 'points']
const MODES = ['targetTime', 'fixed']

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
    if (ctx.role !== 'admin') return { success: false, message: '只有家长(管理员)可配置习惯与奖励' }

    const name = String(event.name || '').trim()
    if (!name) return { success: false, message: '习惯名称不能为空' }
    const mode = MODES.indexOf(event.mode) >= 0 ? event.mode : 'fixed'
    const rewardType = REWARD_TYPES.indexOf(event.rewardType) >= 0 ? event.rewardType : 'time'

    const fields = {
      name: name,
      icon: event.icon ? String(event.icon).slice(0, 4) : '⭐',
      mode: mode,
      targetTime: event.targetTime ? String(event.targetTime) : '',
      maxReward: Math.max(0, Number(event.maxReward) || 0),
      deductOnLate: !!event.deductOnLate,
      fixedReward: Math.max(0, Number(event.fixedReward) || 0),
      rewardType: rewardType,
      cycle: event.cycle === 'weekly' ? 'weekly' : 'daily',
      reminder: event.reminder ? String(event.reminder).slice(0, 100) : '',
      order: Number(event.order) || 0,
      updatedAt: new Date()
    }

    if (event.habitId) {
      const snap = await db.collection('habitDefs').doc(event.habitId).get()
      if (!snap || !snap.data || snap.data.familyId !== ctx.familyId) return { success: false, message: '无权编辑该习惯' }
      await db.collection('habitDefs').doc(event.habitId).update({ data: fields })
      return { success: true, data: { _id: event.habitId } }
    }

    const res = await db.collection('habitDefs').add({
      data: Object.assign({ familyId: ctx.familyId, isDeleted: false, createdAt: new Date() }, fields)
    })
    return { success: true, data: { _id: res._id } }
  } catch (err) {
    return { success: false, message: '保存失败', error: err.message }
  }
}
