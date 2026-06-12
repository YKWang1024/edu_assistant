const cloud = require('wx-server-sdk')

cloud.init()

const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    const userRes = await db.collection('users').where({ openid: openid }).get()
    if (userRes.data.length > 0) {
      return {
        success: true,
        userInfo: userRes.data[0]
      }
    } else {
      return {
        success: true,
        userInfo: null,
        message: '用户未注册'
      }
    }
  } catch (e) {
    return {
      success: false,
      message: e.message
    }
  }
}