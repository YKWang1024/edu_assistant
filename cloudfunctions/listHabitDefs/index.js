// 云函数：列出本家庭的学习习惯定义（REQ-023 自定义习惯）
// 首次调用(家庭还没有任何习惯定义)时懒惰播种「到校/作业/睡觉」三个系统默认习惯，
// 规则与旧版硬编码一致(避免老家庭打卡流程被破坏)；播种后即为普通习惯，家长可编辑/删除。
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

async function resolveFamily(openid) {
  const u = await db.collection('users').where({ openid: openid }).get()
  if (!u.data || !u.data.length) return null
  return { user: u.data[0], familyId: u.data[0].familyId, role: u.data[0].familyRole }
}

const DEFAULT_HABITS = [
  { name: '到校', icon: '🏫', mode: 'targetTime', targetTime: '08:10', maxReward: 999, deductOnLate: false, fixedReward: 0, rewardType: 'time', cycle: 'daily', order: 1 },
  { name: '作业', icon: '📚', mode: 'targetTime', targetTime: '19:30', maxReward: 999, deductOnLate: true, fixedReward: 0, rewardType: 'time', cycle: 'daily', order: 2 },
  { name: '睡觉', icon: '🌙', mode: 'targetTime', targetTime: '21:00', maxReward: 10, deductOnLate: false, fixedReward: 0, rewardType: 'time', cycle: 'daily', order: 3 }
]

exports.main = async (event, context) => {
  const openid = cloud.getWXContext().OPENID
  try {
    const ctx = await resolveFamily(openid)
    if (!ctx || !ctx.familyId) return { success: false, message: '用户未注册或未加入家庭', code: 'NO_FAMILY' }
    const familyId = ctx.familyId

    let all = (await db.collection('habitDefs').where({ familyId: familyId }).orderBy('order', 'asc').limit(200).get()).data || []

    if (!all.length) {
      // 懒惰播种：整个家庭从未有过任何习惯定义(含软删的)才播种，避免家长删光后又被种回来
      const now = new Date()
      for (let i = 0; i < DEFAULT_HABITS.length; i++) {
        await db.collection('habitDefs').add({
          data: Object.assign({ familyId: familyId, isDeleted: false, createdAt: now, updatedAt: now }, DEFAULT_HABITS[i])
        })
      }
      all = (await db.collection('habitDefs').where({ familyId: familyId }).orderBy('order', 'asc').limit(200).get()).data || []
    }

    const list = all.filter(function (h) { return h && !h.isDeleted })
    return { success: true, data: list }
  } catch (err) {
    return { success: false, message: '加载失败', error: err.message }
  }
}
