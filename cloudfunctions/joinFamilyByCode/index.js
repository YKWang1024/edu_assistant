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

async function removeMember(familyId, openid) {
  const f = await db.collection('families').doc(familyId).get()
  const members = ((f.data && f.data.members) || []).filter(function (m) { return m.openid !== openid })
  await db.collection('families').doc(familyId).update({ data: { members: members } })
}

// 加入家庭核心逻辑（被邀请码/卡片两条入口共用）
async function joinFamily(openid, targetFamilyId, displayName, force) {
  const u = await db.collection('users').where({ openid: openid }).get()
  const me = (u.data && u.data[0]) || null

  if (me && me.familyId === targetFamilyId) {
    await ensureMember(targetFamilyId, openid, displayName, me.familyRole || 'member')
    return { success: true, data: { familyId: targetFamilyId }, message: '你已在该家庭中' }
  }
  if (me && me.familyId && me.familyId !== targetFamilyId && !force) {
    return { success: false, code: 'ALREADY_IN_FAMILY', message: '你已在一个家庭中' }
  }
  if (me && me.familyId && me.familyId !== targetFamilyId && force) {
    await removeMember(me.familyId, openid)
  }

  if (me) {
    await db.collection('users').doc(me._id).update({ data: { familyId: targetFamilyId, familyRole: 'member' } })
  } else {
    await db.collection('users').add({
      data: { openid: openid, nickname: displayName || '家庭成员', avatarUrl: '', familyId: targetFamilyId, familyRole: 'member', createdAt: new Date() }
    })
  }
  await ensureMember(targetFamilyId, openid, displayName, 'member')
  return { success: true, data: { familyId: targetFamilyId } }
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
    if (family.inviteCodeExpireAt && new Date(family.inviteCodeExpireAt).getTime() < Date.now()) {
      return { success: false, message: '邀请码已过期，请让管理员重新生成' }
    }

    return await joinFamily(openid, family._id, displayName, force)
  } catch (err) {
    return { success: false, message: '加入失败', error: err.message }
  }
}
