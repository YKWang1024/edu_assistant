// 云函数：消费游戏时间（校验余额充足）
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
    const minutes = Number(event.minutes) || 0
    if (minutes <= 0) return { success: false, message: '请输入有效分钟数' }

    const ctx = await resolveFamily(openid)
    const familyId = ctx ? ctx.familyId : null
    const childName = event.childName || '宝贝'

    const where = familyId ? { familyId: familyId, childName: childName } : { _openid: openid, childName: childName }
    const gt = await db.collection('gameTime').where(where).get()
    const cur = (gt.data && gt.data.length) ? (gt.data[0].balance || 0) : 0

    if (minutes > cur) return { success: false, message: '游戏时间不足' }

    const balance = cur - minutes
    await db.collection('gameTime').doc(gt.data[0]._id).update({ data: { balance: balance, updatedAt: new Date() } })

    return { success: true, data: { balance: balance } }
  } catch (err) {
    return { success: false, message: '扣减失败', error: err.message }
  }
}
