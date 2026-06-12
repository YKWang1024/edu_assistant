// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()

  try {
    const db = cloud.database()
    const openid = wxContext.OPENID
    const { page = 1, pageSize = 20 } = event

    // 获取用户的家庭ID
    const user = await db.collection('users').where({
      openid: openid
    }).get()

    if (!user.data || user.data.length === 0) {
      return {
        success: false,
        message: '用户不存在'
      }
    }

    const familyId = user.data[0].familyId

    // 获取家庭成员
    const family = await db.collection('families').doc(familyId).get()

    if (!family.data) {
      return {
        success: false,
        message: '家庭不存在'
      }
    }

    const memberOpenids = family.data.members.map(m => m.openid)

    // 获取家庭所有菜谱
    const recipesResult = await db.collection('recipes')
      .where({
        userId: db.command.in(memberOpenids)
      })
      .orderBy('createdAt', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get()

    return {
      success: true,
      data: recipesResult.data,
      total: recipesResult.data.length
    }
  } catch (err) {
    return {
      success: false,
      message: '获取失败',
      error: err.message
    }
  }
}
