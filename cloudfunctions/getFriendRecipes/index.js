// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()

  try {
    const db = cloud.database()
    const { page = 1, pageSize = 20, userOpenid } = event

    let query = { isPublic: true }

    // 如果指定了用户，只看该用户的分享
    if (userOpenid) {
      query.userId = userOpenid
    }

    const recipesResult = await db.collection('recipes')
      .where(query)
      .orderBy('sharedAt', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get()

    // 获取发布者信息
    const publisherOpenids = [...new Set(recipesResult.data.map(r => r.userId))]

    let publishers = {}
    if (publisherOpenids.length > 0) {
      const usersResult = await db.collection('users')
        .where({
          openid: db.command.in(publisherOpenids)
        })
        .field({
          openid: true,
          nickname: true,
          avatarUrl: true
        })
        .get()

      usersResult.data.forEach(u => {
        publishers[u.openid] = u
      })
    }

    // 把日期格式化成 UTC+8 的 YYYY-MM-DD 字符串（Date 经 callFunction 序列化不可靠）
    const pad = n => (n < 10 ? '0' : '') + n
    const toDateStr = d => {
      if (!d) return ''
      const t = new Date(d).getTime()
      if (isNaN(t)) return ''
      const x = new Date(t + 8 * 3600 * 1000)
      return x.getUTCFullYear() + '-' + pad(x.getUTCMonth() + 1) + '-' + pad(x.getUTCDate())
    }

    // 添加发布者信息
    const recipesWithPublisher = recipesResult.data.map(r => ({
      ...r,
      publisher: publishers[r.userId] || {},
      sharedDate: toDateStr(r.sharedAt || r.createdAt)
    }))

    return {
      success: true,
      data: recipesWithPublisher,
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
