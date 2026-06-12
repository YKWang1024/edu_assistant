const cloud = require('wx-server-sdk')

cloud.init()

const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    const { recipe, isPublic } = event

    const userRes = await db.collection('users').where({ openid: openid }).get()
    if (userRes.data.length === 0) {
      return {
        success: false,
        message: '用户未注册'
      }
    }

    const user = userRes.data[0]

    await db.collection('recipes').add({
      data: {
        ...recipe,
        familyId: user.familyId,
        userId: openid,
        userName: user.nickname,
        userAvatar: user.avatarUrl,
        isShared: true,
        isPublic: isPublic,
        createdAt: db.serverDate()
      }
    })

    return {
      success: true,
      message: '分享成功'
    }
  } catch (e) {
    return {
      success: false,
      message: e.message
    }
  }
}