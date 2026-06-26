// 云函数：列出我加入的所有家庭(支持多家庭)。返回每个家庭的名称/我的角色/成员数/是否当前。
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async () => {
  const openid = cloud.getWXContext().OPENID
  try {
    const u = await db.collection('users').where({ openid: openid }).get()
    if (!u.data || !u.data.length) return { success: false, message: '用户未注册', code: 'NO_FAMILY' }
    const me = u.data[0]
    const activeId = me.familyId || ''
    let ids = (Array.isArray(me.familyIds) && me.familyIds.length) ? me.familyIds.slice() : (activeId ? [activeId] : [])
    if (activeId && ids.indexOf(activeId) < 0) ids.push(activeId)

    const families = []
    for (const fid of ids) {
      let f
      try { f = await db.collection('families').doc(fid).get() } catch (e) { continue }
      if (!f || !f.data) continue
      const fam = f.data
      const members = fam.members || []
      const mine = members.find(function (m) { return m.openid === openid })
      if (!mine) continue // 已不在该家庭(数据自愈，不展示)
      const admin = members.find(function (m) { return m.role === 'admin' })
      const adminName = (admin && admin.displayName) || '家庭'
      families.push({
        familyId: fid,
        name: adminName + '的家庭',
        role: mine.role || 'member',
        memberCount: members.length,
        childCount: (fam.children || []).filter(function (c) { return c && !c.isDeleted }).length,
        isActive: fid === activeId
      })
    }

    return { success: true, data: { families: families, activeFamilyId: activeId } }
  } catch (err) {
    return { success: false, message: '获取失败', error: err.message }
  }
}
