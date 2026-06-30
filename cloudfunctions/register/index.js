// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()

  try {
    const db = cloud.database()
    const openid = wxContext.OPENID
    const { nickname, avatarUrl } = event

    // 检查用户是否已注册
    const existUser = await db.collection('users').where({
      openid: openid
    }).get()

    if (existUser.data && existUser.data.length > 0) {
      return {
        success: false,
        message: '用户已注册'
      }
    }

    // 创建家庭
    const familyResult = await db.collection('families').add({
      data: {
        createdAt: new Date(),
        seeded: false, // REQ-022：不再自动批量生成菜谱，改为按需从系统菜谱库导入
        members: [{
          openid: openid,
          role: 'admin',
          joinedAt: new Date(),
          displayName: nickname || '用户'
        }]
      }
    })

    // 创建用户
    const userResult = await db.collection('users').add({
      data: {
        openid: openid,
        nickname: nickname || '用户',
        avatarUrl: avatarUrl || '',
        familyId: familyResult._id,
        familyRole: 'admin',
        createdAt: new Date()
      }
    })

    // REQ-022：取消注册时自动批量生成示例菜谱；改为用户在菜谱页(无菜品时)按需从系统菜谱库导入。

    const userInfo = {
      _id: userResult._id,
      openid: openid,
      nickname: nickname || '用户',
      avatarUrl: avatarUrl || '',
      familyId: familyResult._id,
      familyRole: 'admin'
    }

    return {
      success: true,
      message: '注册成功',
      userInfo: userInfo,
      familyId: familyResult._id,
      data: {
        userId: userResult._id,
        familyId: familyResult._id,
        openid: openid
      }
    }
  } catch (err) {
    return {
      success: false,
      message: '注册失败',
      error: err.message
    }
  }
}
