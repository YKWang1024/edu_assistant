// 云函数：退出某个家庭(多家庭)。从该家庭成员里移除自己，并更新我的 familyIds；
// 若退出的是当前家庭，则自动切换到剩余的某个家庭。至少保留一个家庭，不能退出最后一个。
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

    let ids = (Array.isArray(me.familyIds) && me.familyIds.length) ? me.familyIds.slice() : (me.familyId ? [me.familyId] : [])
    if (ids.indexOf(targetId) < 0 && me.familyId !== targetId) {
      return { success: false, message: '你不在该家庭中' }
    }
    if (ids.length <= 1) {
      return { success: false, message: '至少保留一个家庭，不能退出最后一个' }
    }

    // 从该家庭成员中移除自己
    try {
      const f = await db.collection('families').doc(targetId).get()
      if (f && f.data) {
        const members = (f.data.members || []).filter(function (m) { return m.openid !== openid })
        await db.collection('families').doc(targetId).update({ data: { members: members } })
      }
    } catch (e) { /* 家庭可能已不存在，忽略 */ }

    ids = ids.filter(function (id) { return id !== targetId })

    let newActive = me.familyId
    let newRole = me.familyRole || 'member'
    if (me.familyId === targetId) {
      newActive = ids[0]
      try {
        const nf = await db.collection('families').doc(newActive).get()
        const nm = ((nf.data && nf.data.members) || []).find(function (m) { return m.openid === openid })
        newRole = (nm && nm.role) || 'member'
      } catch (e) { newRole = 'member' }
    }

    await db.collection('users').doc(me._id).update({
      data: { familyId: newActive, familyIds: ids, familyRole: newRole }
    })
    return { success: true, data: { familyId: newActive } }
  } catch (err) {
    return { success: false, message: '退出失败', error: err.message }
  }
}
