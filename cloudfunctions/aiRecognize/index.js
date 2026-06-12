// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

// 常见食物营养数据（每100g）
const FOOD_DATABASE = {
  // 主食类
  '米饭': { calories: 116, protein: 2.6, fat: 0.3, carbs: 25.9 },
  '面条': { calories: 284, protein: 8.3, fat: 0.8, carbs: 59.5 },
  '馒头': { calories: 223, protein: 7.0, fat: 1.1, carbs: 47.0 },
  '包子': { calories: 227, protein: 9.1, fat: 6.4, carbs: 36.0 },
  '饺子': { calories: 242, protein: 12.3, fat: 12.0, carbs: 26.0 },
  '面包': { calories: 265, protein: 8.0, fat: 3.2, carbs: 50.0 },

  // 肉类
  '猪肉': { calories: 143, protein: 21.3, fat: 6.2, carbs: 0 },
  '牛肉': { calories: 125, protein: 19.9, fat: 4.2, carbs: 0 },
  '鸡肉': { calories: 133, protein: 20.3, fat: 4.5, carbs: 0 },
  '鸭肉': { calories: 149, protein: 17.3, fat: 8.0, carbs: 0 },
  '鱼肉': { calories: 90, protein: 18.0, fat: 2.0, carbs: 0 },
  '虾': { calories: 93, protein: 18.0, fat: 0.8, carbs: 2.0 },

  // 蛋类
  '鸡蛋': { calories: 144, protein: 13.3, fat: 8.8, carbs: 1.5 },
  '鸭蛋': { calories: 180, protein: 13.0, fat: 14.0, carbs: 1.0 },

  // 蔬菜类
  '白菜': { calories: 17, protein: 1.5, fat: 0.3, carbs: 2.4 },
  '菠菜': { calories: 20, protein: 2.6, fat: 0.3, carbs: 2.8 },
  '西红柿': { calories: 15, protein: 0.9, fat: 0.2, carbs: 3.0 },
  '黄瓜': { calories: 15, protein: 0.8, fat: 0.2, carbs: 2.9 },
  '土豆': { calories: 76, protein: 2.0, fat: 0.1, carbs: 17.0 },
  '红薯': { calories: 99, protein: 1.1, fat: 0.1, carbs: 24.0 },
  '胡萝卜': { calories: 35, protein: 0.9, fat: 0.2, carbs: 8.0 },

  // 水果类
  '苹果': { calories: 52, protein: 0.3, fat: 0.2, carbs: 13.0 },
  '香蕉': { calories: 93, protein: 1.4, fat: 0.2, carbs: 22.0 },
  '橙子': { calories: 47, protein: 0.9, fat: 0.1, carbs: 11.0 },

  // 饮品
  '牛奶': { calories: 54, protein: 3.0, fat: 3.2, carbs: 3.4 },
  '豆浆': { calories: 33, protein: 2.9, fat: 1.2, carbs: 1.2 },

  // 其他
  '豆腐': { calories: 81, protein: 8.1, fat: 3.7, carbs: 4.2 },
  '红烧肉': { calories: 478, protein: 13.0, fat: 45.0, carbs: 7.0 },
  '糖醋排骨': { calories: 264, protein: 15.0, fat: 18.0, carbs: 12.0 },
  '宫保鸡丁': { calories: 197, protein: 18.0, fat: 10.0, carbs: 8.0 },
  '麻婆豆腐': { calories: 135, protein: 10.0, fat: 8.0, carbs: 6.0 },
  '鱼香肉丝': { calories: 185, protein: 12.0, fat: 11.0, carbs: 8.0 }
}

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()

  try {
    const { foodName } = event

    if (!foodName) {
      return {
        success: false,
        message: '请输入食物名称'
      }
    }

    // 精确匹配
    let nutrition = FOOD_DATABASE[foodName]

    // 模糊匹配
    if (!nutrition) {
      const foodNames = Object.keys(FOOD_DATABASE)
      for (let name of foodNames) {
        if (foodName.includes(name) || name.includes(foodName)) {
          nutrition = FOOD_DATABASE[name]
          break
        }
      }
    }

    if (nutrition) {
      return {
        success: true,
        data: {
          foodName: foodName,
          ...nutrition,
          unit: '每100g',
          tips: getDietTips(nutrition.calories)
        }
      }
    } else {
      return {
        success: false,
        message: '未找到该食物的营养数据，请尝试其他常见食物名称'
      }
    }
  } catch (err) {
    return {
      success: false,
      message: '识别失败',
      error: err.message
    }
  }
}

// 获取饮食建议
function getDietTips(calories) {
  if (calories < 50) {
    return '热量较低，可以放心食用'
  } else if (calories < 150) {
    return '热量适中，建议适量食用'
  } else if (calories < 300) {
    return '热量较高，应控制摄入量'
  } else {
    return '热量较高，建议少吃或配合运动'
  }
}
