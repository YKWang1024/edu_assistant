// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()

  try {
    const db = cloud.database()
    const openid = wxContext.OPENID

    // 查找用户
    const userResult = await db.collection('users').where({
      openid: openid
    }).get()

    if (userResult.data && userResult.data.length > 0) {
      return {
        success: true,
        userInfo: userResult.data[0],
        familyId: userResult.data[0].familyId,
        data: userResult.data[0],
        message: '登录成功'
      }
    } else {
      return {
        success: false,
        message: '用户未注册，请先注册'
      }
    }
  } catch (err) {
    return {
      success: false,
      message: '登录失败',
      error: err.message
    }
  }
}
