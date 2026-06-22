// 云函数：通过转发卡片携带的 familyId 加入家庭
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
    const { familyId, displayName, force } = event
    if (!familyId) return { success: false, message: '缺少家庭ID' }

    const f = await db.collection('families').doc(familyId).get()
    if (!f.data) return { success: false, message: '该家庭不存在' }

    return await joinFamily(openid, familyId, displayName, force)
  } catch (err) {
    return { success: false, message: '加入失败', error: err.message }
  }
}
