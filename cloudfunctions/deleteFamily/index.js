// 云函数：删除一个家庭（安全删除：仅管理员、且该家庭只剩自己一个成员、且不是你唯一的家庭）
// 设计取舍：只允许删「自己独有、无其他成员」的家庭，避免把别人正在用的家庭/数据连带销毁。
// 多成员家庭需其他成员先退出。删除采用软删(isDeleted+清空 members)，关联数据(菜谱/错题等)保留但不可达，可恢复。
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const openid = cloud.getWXContext().OPENID
  try {
    const targetId = event.familyId
    if (!targetId) return { success: false, message: '缺少家庭ID' }

    const u = await db.collection('users').where({ openid: openid }).get()
    if (!u.data || !u.data.length) return { success: false, message: '用户未注册' }
    const me = u.data[0]

    // 归一化我的家庭列表
    let ids = (Array.isArray(me.familyIds) && me.familyIds.length) ? me.familyIds.slice() : []
    if (me.familyId && ids.indexOf(me.familyId) < 0) ids.push(me.familyId)
    ids = Array.from(new Set(ids))

    if (ids.indexOf(targetId) < 0) return { success: false, message: '你不在该家庭中' }
    if (ids.length <= 1) return { success: false, message: '至少保留一个家庭，不能删除唯一的家庭' }

    const f = await db.collection('families').doc(targetId).get()
    if (!f || !f.data) return { success: false, message: '家庭不存在' }
    const fam = f.data
    const members = fam.members || []
    const mine = members.find(function (m) { return m.openid === openid })
    if (!mine || mine.role !== 'admin') return { success: false, message: '只有管理员可以删除家庭' }
    const others = members.filter(function (m) { return m.openid !== openid })
    if (others.length > 0) return { success: false, message: '该家庭还有其他成员，请先让他们退出后再删除' }

    // 软删除家庭文档：清空 members + 失效邀请码(防止用旧码把已删家庭「复活」成僵尸家庭)
    await db.collection('families').doc(targetId).update({
      data: { isDeleted: true, deletedAt: new Date(), members: [], inviteCode: '', inviteCodeExpireAt: new Date(0) }
    })

    // 从我的 familyIds 移除；若删的是当前家庭，挑一个「存在、未软删、我仍是成员」的家庭作为当前
    ids = ids.filter(function (id) { return id !== targetId })
    let newActive = me.familyId
    let newRole = me.familyRole || 'member'
    if (me.familyId === targetId) {
      newActive = ''
      for (let i = 0; i < ids.length; i++) {
        try {
          const nf = await db.collection('families').doc(ids[i]).get()
          const fdat = nf && nf.data
          if (!fdat || fdat.isDeleted) continue
          const nm = (fdat.members || []).find(function (m) { return m.openid === openid })
          if (!nm) continue
          newActive = ids[i]
          newRole = nm.role || 'member'
          break
        } catch (e) { /* 跳过无效家庭 */ }
      }
    }
    if (!newActive) return { success: false, message: '没有可切换的有效家庭' }

    await db.collection('users').doc(me._id).update({
      data: { familyId: newActive, familyIds: ids, familyRole: newRole }
    })

    return { success: true, data: { familyId: newActive } }
  } catch (err) {
    return { success: false, message: '删除失败', error: err.message }
  }
}
