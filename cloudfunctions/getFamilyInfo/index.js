// 云函数：获取当前用户所在家庭的信息（成员列表 + 我的角色 + 邀请码<仅管理员>）
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

async function resolveFamily(openid) {
  const u = await db.collection('users').where({ openid: openid }).get()
  if (!u.data || !u.data.length) return null
  return { user: u.data[0], familyId: u.data[0].familyId, role: u.data[0].familyRole }
}

exports.main = async (event, context) => {
  const openid = cloud.getWXContext().OPENID
  try {
    const ctx = await resolveFamily(openid)
    if (!ctx || !ctx.familyId) return { success: false, message: '用户未注册或未加入家庭', code: 'NO_FAMILY' }

    const fam = await db.collection('families').doc(ctx.familyId).get()
    const family = fam.data || {}
    const rawMembers = family.members || []

    // 用 users 表补全昵称/头像
    const openids = rawMembers.map(function (m) { return m.openid })
    const userMap = {}
    if (openids.length) {
      const us = await db.collection('users').where({ openid: _.in(openids) })
        .field({ openid: true, nickname: true, avatarUrl: true }).get()
      ;(us.data || []).forEach(function (u) { userMap[u.openid] = u })
    }

    const members = rawMembers.map(function (m) {
      const u = userMap[m.openid] || {}
      return {
        openid: m.openid,
        role: m.role || 'member',
        displayName: m.displayName || u.nickname || '成员',
        avatarUrl: u.avatarUrl || '',
        joinedAt: m.joinedAt || null,
        isMe: m.openid === openid
      }
    })

    return {
      success: true,
      data: {
        familyId: ctx.familyId,
        myRole: ctx.role,
        members: members,
        inviteCode: ctx.role === 'admin' ? (family.inviteCode || '') : '',
        inviteCodeExpireAt: family.inviteCodeExpireAt || null
      }
    }
  } catch (err) {
    return { success: false, message: '获取家庭信息失败', error: err.message }
  }
}
