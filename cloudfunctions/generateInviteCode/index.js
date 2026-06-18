// 云函数：管理员生成/刷新家庭邀请码（6 位，去除易混字符，查重，7 天有效）
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // 去掉 O/0/I/1

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

exports.main = async (event, context) => {
  const openid = cloud.getWXContext().OPENID
  try {
    const ctx = await resolveFamily(openid)
    if (!ctx || !ctx.familyId) return { success: false, message: '用户未注册或未加入家庭' }
    if (ctx.role !== 'admin') return { success: false, message: '只有管理员可以生成邀请码' }

    let code = ''
    for (let tries = 0; tries < 8; tries++) {
      code = genCode()
      const exist = await db.collection('families').where({ inviteCode: code }).get()
      if (!exist.data || !exist.data.length) break
    }

    const expireAt = new Date(Date.now() + 7 * 24 * 3600 * 1000)
    await db.collection('families').doc(ctx.familyId).update({
      data: { inviteCode: code, inviteCodeExpireAt: expireAt }
    })

    return { success: true, data: { code: code, expireAt: expireAt, familyId: ctx.familyId } }
  } catch (err) {
    return { success: false, message: '生成失败', error: err.message }
  }
}
