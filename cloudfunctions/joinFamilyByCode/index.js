// 云函数：通过邀请码加入家庭
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

async function ensureMember(familyId, openid, displayName, role) {
  const f = await db.collection('families').doc(familyId).get()
  const members = (f.data && f.data.members) || []
  const idx = members.findIndex(function (m) { return m.openid === openid })
  if (idx >= 0) {
    members[idx].displayName = displayName || members[idx].displayName || ''
    await db.collection('families').doc(familyId).update({ data: { members: members } })
  } else {
    await db.collection('families').doc(familyId).update({
      data: { members: db.command.push([{ openid: openid, role: role || 'member', joinedAt: new Date(), displayName: displayName || '' }]) }
    })
  }
}

// 加入家庭核心逻辑（被邀请码/卡片两条入口共用）。
// 多家庭：加入是「追加」——保留原有家庭，新家庭设为当前(familyId)，全部记入 familyIds。
async function joinFamily(openid, targetFamilyId, displayName) {
  const u = await db.collection('users').where({ openid: openid }).get()
  const me = (u.data && u.data[0]) || null

  await ensureMember(targetFamilyId, openid, displayName, 'member')

  // 读取我在目标家庭的角色(已在则保留原角色)
  const f2 = await db.collection('families').doc(targetFamilyId).get()
  const mem = ((f2.data && f2.data.members) || []).find(function (m) { return m.openid === openid })
  const role = (mem && mem.role) || 'member'

  if (me) {
    let ids = (Array.isArray(me.familyIds) && me.familyIds.length) ? me.familyIds.slice() : (me.familyId ? [me.familyId] : [])
    const already = ids.indexOf(targetFamilyId) >= 0
    if (!already) ids.push(targetFamilyId)
    ids = Array.from(new Set(ids))
    await db.collection('users').doc(me._id).update({ data: { familyId: targetFamilyId, familyIds: ids, familyRole: role } })
    return { success: true, data: { familyId: targetFamilyId }, message: already ? '已切换到该家庭' : '已加入家庭' }
  } else {
    await db.collection('users').add({
      data: { openid: openid, nickname: displayName || '家庭成员', avatarUrl: '', familyId: targetFamilyId, familyIds: [targetFamilyId], familyRole: role, createdAt: new Date() }
    })
    return { success: true, data: { familyId: targetFamilyId } }
  }
}

exports.main = async (event, context) => {
  const openid = cloud.getWXContext().OPENID
  try {
    const { code, displayName, force } = event
    if (!code) return { success: false, message: '请输入邀请码' }
    const codeNorm = String(code).trim().toUpperCase()

    const fam = await db.collection('families').where({ inviteCode: codeNorm }).get()
    if (!fam.data || !fam.data.length) return { success: false, message: '邀请码无效' }
    const family = fam.data[0]
    if (family.isDeleted) return { success: false, message: '该家庭已删除' }
    if (family.inviteCodeExpireAt && new Date(family.inviteCodeExpireAt).getTime() < Date.now()) {
      return { success: false, message: '邀请码已过期，请让管理员重新生成' }
    }

    return await joinFamily(openid, family._id, displayName, force)
  } catch (err) {
    return { success: false, message: '加入失败', error: err.message }
  }
}
