// 云函数：获取当前用户所在家庭的信息（成员列表 + 我的角色 + 邀请码<仅管理员>）
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function genCode() {
  let s = ''
  for (let i = 0; i < 6; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  return s
}

async function resolveFamily(openid) {
  const u = await db.collection('users').where({ openid: openid }).get()
  if (!u.data || !u.data.length) return null
  return { user: u.data[0], familyId: u.data[0].familyId, role: u.data[0].familyRole }
}

// 头像 fileID → 临时链接(同家庭成员互相可见)
async function buildTempUrlMap(fileIDs) {
  const ids = Array.from(new Set((fileIDs || []).filter(function (f) { return typeof f === 'string' && f.indexOf('cloud://') === 0 })))
  const map = {}
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50)
    try {
      const r = await cloud.getTempFileURL({ fileList: chunk })
      ;(r.fileList || []).forEach(function (f) { if (f.fileID && f.tempFileURL) map[f.fileID] = f.tempFileURL })
    } catch (e) { /* 失败保留原值 */ }
  }
  return map
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

    // 头像 fileID → 临时链接（成员头像 + 小孩头像 REQ-012）
    const avatarIDs = []
    Object.keys(userMap).forEach(function (k) { if (userMap[k].avatarUrl) avatarIDs.push(userMap[k].avatarUrl) })
    ;(family.children || []).forEach(function (c) { if (c && c.avatar) avatarIDs.push(c.avatar) })
    const avatarMap = await buildTempUrlMap(avatarIDs)

    const members = rawMembers.map(function (m) {
      const u = userMap[m.openid] || {}
      return {
        openid: m.openid,
        role: m.role || 'member',
        displayName: m.displayName || u.nickname || '成员',
        avatarUrl: u.avatarUrl ? (avatarMap[u.avatarUrl] || u.avatarUrl) : '',
        joinedAt: m.joinedAt || null,
        isMe: m.openid === openid
      }
    })

    // 无账号的小孩成员（妹妹/姐姐等），软删除的不返回。含年龄/头像(REQ-012)
    const children = (family.children || [])
      .filter(function (c) { return c && !c.isDeleted })
      .map(function (c) {
        return {
          childId: c.childId,
          name: c.name,
          grade: c.grade || '',
          age: c.age || '',
          avatar: c.avatar ? (avatarMap[c.avatar] || c.avatar) : ''
        }
      })

    // 补全家庭码：无论谁查看、家庭如何创建，都保证有码可见
    let inviteCode = family.inviteCode || ''
    let inviteExpire = family.inviteCodeExpireAt || null
    if (!inviteCode) {
      for (let t = 0; t < 8; t++) {
        const c = genCode()
        const ex = await db.collection('families').where({ inviteCode: c }).get()
        if (!ex.data || !ex.data.length) { inviteCode = c; break }
      }
      if (inviteCode) {
        inviteExpire = new Date(Date.now() + 7 * 24 * 3600 * 1000)
        await db.collection('families').doc(ctx.familyId).update({ data: { inviteCode: inviteCode, inviteCodeExpireAt: inviteExpire } })
      }
    }

    return {
      success: true,
      data: {
        familyId: ctx.familyId,
        familyName: family.name || ((((family.members || []).find(function (m) { return m.role === 'admin' }) || {}).displayName || '家庭') + '的家庭'),
        myRole: ctx.role,
        members: members,
        children: children,
        inviteCode: inviteCode,
        inviteCodeExpireAt: inviteExpire
      }
    }
  } catch (err) {
    return { success: false, message: '获取家庭信息失败', error: err.message }
  }
}
