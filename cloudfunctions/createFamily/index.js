// 云函数：主动新建一个家庭（当前用户为管理员，并切换为当前家庭）
// 与 login 自动建家庭一致：生成唯一邀请码、默认一个无账号小孩「宝贝」；不预置示例菜谱(保持新家庭干净)。
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // 去掉易混 O/0/I/1
function genCode() {
  let s = ''
  for (let i = 0; i < 6; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  return s
}

exports.main = async (event, context) => {
  const openid = cloud.getWXContext().OPENID
  try {
    const u = await db.collection('users').where({ openid: openid }).get()
    if (!u.data || !u.data.length) return { success: false, message: '用户未注册' }
    const me = u.data[0]

    const name = (String(event.name || '').trim()) || ((me.nickname || '家长') + '的家庭')
    const displayName = (String(event.displayName || '').trim()) || me.nickname || '家长'

    // 生成唯一邀请码
    let code = ''
    for (let t = 0; t < 8; t++) {
      code = genCode()
      const ex = await db.collection('families').where({ inviteCode: code }).get()
      if (!ex.data || !ex.data.length) break
    }
    const expireAt = new Date(Date.now() + 7 * 24 * 3600 * 1000)

    const fam = await db.collection('families').add({
      data: {
        createdAt: new Date(),
        seeded: false,
        name: name,
        inviteCode: code,
        inviteCodeExpireAt: expireAt,
        members: [{ openid: openid, role: 'admin', joinedAt: new Date(), displayName: displayName }],
        children: [{ childId: 'c_' + Date.now() + '_' + Math.floor(Math.random() * 1000000), name: '宝贝', grade: '', isDeleted: false, createdAt: new Date() }]
      }
    })

    // 更新用户：追加到 familyIds 并切换为当前家庭
    let ids = (Array.isArray(me.familyIds) && me.familyIds.length) ? me.familyIds.slice() : []
    if (me.familyId && ids.indexOf(me.familyId) < 0) ids.push(me.familyId)
    ids = Array.from(new Set(ids))
    ids.push(fam._id)

    await db.collection('users').doc(me._id).update({
      data: { familyId: fam._id, familyIds: ids, familyRole: 'admin' }
    })

    return { success: true, data: { familyId: fam._id, inviteCode: code } }
  } catch (err) {
    return { success: false, message: '创建失败', error: err.message }
  }
}
