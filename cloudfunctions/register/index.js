const cloud = require('wx-server-sdk')

cloud.init()

const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    const { nickname, avatarUrl } = event

    const userRes = await db.collection('users').where({ openid: openid }).get()
    if (userRes.data.length > 0) {
      return {
        success: false,
        message: '用户已注册'
      }
    }

    const familyId = 'family_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)

    await db.collection('users').add({
      data: {
        openid: openid,
        nickname: nickname,
        avatarUrl: avatarUrl,
        familyId: familyId,
        familyRole: 'owner',
        createdAt: db.serverDate()
      }
    })

    await db.collection('families').add({
      data: {
        _id: familyId,
        members: [{
          openid: openid,
          nickname: nickname,
          role: 'owner'
        }],
        createdAt: db.serverDate()
      }
    })

    return {
      success: true,
      userInfo: {
        openid: openid,
        nickname: nickname,
        avatarUrl: avatarUrl,
        familyId: familyId,
        familyRole: 'owner'
      },
      familyId: familyId
    }
  } catch (e) {
    return {
      success: false,
      message: e.message
    }
  }
}