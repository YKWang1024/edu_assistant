// 云函数：切换当前家庭(多家庭)。把 users.familyId 指向目标家庭，并同步该家庭里我的角色。
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event) => {
  const openid = cloud.getWXContext().OPENID
  try {
    const targetId = event.familyId
    if (!targetId) return { success: false, message: '缺少家庭ID' }

    const u = await db.collection('users').where({ openid: openid }).get()
    if (!u.data || !u.data.length) return { success: false, message: '用户未注册' }
    const me = u.data[0]

    const f = await db.collection('families').doc(targetId).get()
    if (!f || !f.data) return { success: false, message: '家庭不存在' }
    const mine = ((f.data.members) || []).find(function (m) { return m.openid === openid })
    if (!mine) return { success: false, message: '你不在该家庭中' }

    let ids = (Array.isArray(me.familyIds) && me.familyIds.length) ? me.familyIds.slice() : (me.familyId ? [me.familyId] : [])
    if (ids.indexOf(targetId) < 0) ids.push(targetId)

    await db.collection('users').doc(me._id).update({
      data: { familyId: targetId, familyIds: ids, familyRole: mine.role || 'member' }
    })
    return { success: true, data: { familyId: targetId } }
  } catch (err) {
    return { success: false, message: '切换失败', error: err.message }
  }
}
