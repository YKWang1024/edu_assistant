// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()

  try {
    const db = cloud.database()
    const openid = wxContext.OPENID
    const { recipeId, shareMessage } = event

    // 验证菜谱归属
    const recipe = await db.collection('recipes').doc(recipeId).get()

    if (!recipe.data) {
      return {
        success: false,
        message: '菜谱不存在'
      }
    }

    if (recipe.data.userId !== openid) {
      return {
        success: false,
        message: '只能分享自己的菜谱'
      }
    }

    // 更新为公开分享
    await db.collection('recipes').doc(recipeId).update({
      data: {
        isPublic: true,
        isShared: true,
        sharedAt: new Date(),
        shareMessage: shareMessage || '',
        shareCount: db.command.inc(1)
      }
    })

    return {
      success: true,
      message: '分享成功'
    }
  } catch (err) {
    return {
      success: false,
      message: '分享失败',
      error: err.message
    }
  }
}
