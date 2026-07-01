// 云函数：微信自动登录（按 openid 静默登录；新用户自动建家庭+用户+邀请码+示例菜谱）
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // 去掉易混 O/0/I/1
function genCode() {
  let s = ''
  for (let i = 0; i < 6; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  return s
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    const db = cloud.database()

    // 已注册 → 直接登录
    const userResult = await db.collection('users').where({ openid: openid }).get()
    if (userResult.data && userResult.data.length > 0) {
      const u = userResult.data[0]
      return { success: true, userInfo: u, familyId: u.familyId, data: u, message: '登录成功' }
    }

    // —— 微信自动登录：首次进入自动建账号 + 家庭 ——
    const nickname = (event && event.nickname) || '家长'
    const avatarUrl = (event && event.avatarUrl) || ''

    // 生成唯一邀请码
    let code = ''
    for (let t = 0; t < 8; t++) {
      code = genCode()
      const ex = await db.collection('families').where({ inviteCode: code }).get()
      if (!ex.data || !ex.data.length) break
    }
    const expireAt = new Date(Date.now() + 7 * 24 * 3600 * 1000)

    const familyResult = await db.collection('families').add({
      data: {
        createdAt: new Date(),
        seeded: false, // REQ-022：不再自动批量生成菜谱，改为按需从系统菜谱库导入
        name: nickname + '的家庭', // 家庭名称，可在家庭管理里改
        inviteCode: code,
        inviteCodeExpireAt: expireAt,
        members: [{ openid: openid, role: 'admin', joinedAt: new Date(), displayName: nickname }],
        // 默认一个无账号小孩成员，保证已有「错题/打分」流程有归属
        children: [{ childId: 'c_' + Date.now() + '_' + Math.floor(Math.random() * 1000000), name: '宝贝', grade: '', isDeleted: false, createdAt: new Date() }]
      }
    })

    const newUser = await db.collection('users').add({
      data: {
        openid: openid,
        nickname: nickname,
        avatarUrl: avatarUrl,
        familyId: familyResult._id,
        familyIds: [familyResult._id], // 支持加入多个家庭：familyId 为「当前」, familyIds 为全部
        familyRole: 'admin',
        createdAt: new Date()
      }
    })

    // REQ-022：取消「新用户自动批量生成示例菜谱」。改为用户在菜谱页(无菜品时)按需从系统菜谱库导入。

    const userInfo = {
      _id: newUser._id,
      openid: openid,
      nickname: nickname,
      avatarUrl: avatarUrl,
      familyId: familyResult._id,
      familyIds: [familyResult._id],
      familyRole: 'admin'
    }
    return { success: true, userInfo: userInfo, familyId: familyResult._id, data: userInfo, autoCreated: true, message: '自动登录成功' }
  } catch (err) {
    return { success: false, message: '登录失败', error: err.message }
  }
}
