// 云函数：保存一次习惯打卡到家庭(同家庭+孩子+类型+当天 已存在则更新)
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

function pad(n) { return (n < 10 ? '0' : '') + n }
function dateStrUTC8() {
  const d = new Date(Date.now() + 8 * 3600 * 1000)
  return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate())
}
function timeStrUTC8() {
  const d = new Date(Date.now() + 8 * 3600 * 1000)
  return pad(d.getUTCHours()) + ':' + pad(d.getUTCMinutes())
}

async function resolveFamily(openid) {
  const u = await db.collection('users').where({ openid: openid }).get()
  if (!u.data || !u.data.length) return null
  return { user: u.data[0], familyId: u.data[0].familyId, role: u.data[0].familyRole }
}

exports.main = async (event, context) => {
  const openid = cloud.getWXContext().OPENID

  try {
    const { type, actualTime, targetTime, reward, diff, isEarly, isLate, date, time, childName } = event
    if (!type) return { success: false, message: '缺少打卡类型' }

    const ctx = await resolveFamily(openid)
    const familyId = ctx ? ctx.familyId : null
    const cn = childName || '宝贝'
    const d = date || dateStrUTC8()

    const fields = {
      actualTime: actualTime || '',
      targetTime: targetTime || '',
      reward: Number(reward) || 0,
      diff: Number(diff) || 0,
      isEarly: !!isEarly,
      isLate: !!isLate,
      time: time || timeStrUTC8(),
      updatedAt: new Date()
    }

    const where = familyId
      ? { familyId: familyId, childName: cn, type: type, date: d }
      : { _openid: openid, childName: cn, type: type, date: d }

    const existing = await db.collection('familyCheckins').where(where).get()
    if (existing.data && existing.data.length) {
      await db.collection('familyCheckins').doc(existing.data[0]._id).update({ data: fields })
      return { success: true, data: { _id: existing.data[0]._id, updated: true } }
    }

    const res = await db.collection('familyCheckins').add({
      data: Object.assign({
        _openid: openid,
        familyId: familyId,
        childName: cn,
        type: type,
        date: d,
        createdAt: new Date()
      }, fields)
    })
    return { success: true, data: { _id: res._id } }
  } catch (err) {
    return { success: false, message: '保存失败', error: err.message }
  }
}
