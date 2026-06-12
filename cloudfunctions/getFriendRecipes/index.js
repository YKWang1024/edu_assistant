const cloud = require('wx-server-sdk')

cloud.init()

const db = cloud.database()

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    const userRes = await db.collection('users').where({ openid: openid }).get()
    if (userRes.data.length === 0) {
      return {
        success: false,
        message: '用户未注册'
      }
    }

    const recipesRes = await db.collection('recipes').where({
      isPublic: true,
      isShared: true
    }).orderBy('createdAt', 'desc').get()

    return {
      success: true,
      recipes: recipesRes.data
    }
  } catch (e) {
    return {
      success: false,
      message: e.message
    }
  }
}