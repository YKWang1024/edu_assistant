var shiziList = [
  { char: '天', pinyin: 'tiān' },
  { char: '地', pinyin: 'dì' },
  { char: '人', pinyin: 'rén' },
  { char: '你', pinyin: 'nǐ' },
  { char: '我', pinyin: 'wǒ' },
  { char: '他', pinyin: 'tā' },
  { char: '一', pinyin: 'yī' },
  { char: '二', pinyin: 'èr' },
  { char: '三', pinyin: 'sān' },
  { char: '四', pinyin: 'sì' },
  { char: '五', pinyin: 'wǔ' },
  { char: '上', pinyin: 'shàng' },
  { char: '下', pinyin: 'xià' },
  { char: '口', pinyin: 'kǒu' },
  { char: '耳', pinyin: 'ěr' },
  { char: '目', pinyin: 'mù' },
  { char: '手', pinyin: 'shǒu' },
  { char: '足', pinyin: 'zú' },
  { char: '日', pinyin: 'rì' },
  { char: '月', pinyin: 'yuè' },
  { char: '水', pinyin: 'shuǐ' },
  { char: '火', pinyin: 'huǒ' },
  { char: '山', pinyin: 'shān' },
  { char: '石', pinyin: 'shí' },
  { char: '田', pinyin: 'tián' },
  { char: '禾', pinyin: 'hé' },
  { char: '对', pinyin: 'duì' },
  { char: '云', pinyin: 'yún' },
  { char: '雨', pinyin: 'yǔ' },
  { char: '风', pinyin: 'fēng' },
  { char: '花', pinyin: 'huā' },
  { char: '鸟', pinyin: 'niǎo' },
  { char: '虫', pinyin: 'chóng' },
  { char: '六', pinyin: 'liù' },
  { char: '七', pinyin: 'qī' },
  { char: '八', pinyin: 'bā' },
  { char: '九', pinyin: 'jiǔ' },
  { char: '十', pinyin: 'shí' },
  { char: '爸', pinyin: 'bà' },
  { char: '妈', pinyin: 'mā' },
  { char: '马', pinyin: 'mǎ' },
  { char: '土', pinyin: 'tǔ' },
  { char: '不', pinyin: 'bù' },
  { char: '画', pinyin: 'huà' },
  { char: '打', pinyin: 'dǎ' },
  { char: '棋', pinyin: 'qí' },
  { char: '鸡', pinyin: 'jī' },
  { char: '字', pinyin: 'zì' },
  { char: '词', pinyin: 'cí' },
  { char: '语', pinyin: 'yǔ' },
  { char: '句', pinyin: 'jù' },
  { char: '子', pinyin: 'zǐ' },
  { char: '桌', pinyin: 'zhuō' },
  { char: '纸', pinyin: 'zhǐ' },
  { char: '文', pinyin: 'wén' },
  { char: '数', pinyin: 'shù' },
  { char: '学', pinyin: 'xué' },
  { char: '音', pinyin: 'yīn' },
  { char: '乐', pinyin: 'yuè' }
]

var xiezilist = [
  { char: '一', pinyin: 'yī' },
  { char: '二', pinyin: 'èr' },
  { char: '三', pinyin: 'sān' },
  { char: '上', pinyin: 'shàng' },
  { char: '口', pinyin: 'kǒu' },
  { char: '目', pinyin: 'mù' },
  { char: '耳', pinyin: 'ěr' },
  { char: '手', pinyin: 'shǒu' },
  { char: '日', pinyin: 'rì' },
  { char: '田', pinyin: 'tián' },
  { char: '禾', pinyin: 'hé' },
  { char: '火', pinyin: 'huǒ' },
  { char: '虫', pinyin: 'chóng' },
  { char: '云', pinyin: 'yún' },
  { char: '山', pinyin: 'shān' },
  { char: '八', pinyin: 'bā' },
  { char: '十', pinyin: 'shí' },
  { char: '了', pinyin: 'le' },
  { char: '子', pinyin: 'zǐ' },
  { char: '人', pinyin: 'rén' },
  { char: '大', pinyin: 'dà' },
  { char: '月', pinyin: 'yuè' },
  { char: '儿', pinyin: 'ér' },
  { char: '头', pinyin: 'tóu' },
  { char: '里', pinyin: 'lǐ' },
  { char: '可', pinyin: 'kě' },
  { char: '东', pinyin: 'dōng' },
  { char: '西', pinyin: 'xī' },
  { char: '天', pinyin: 'tiān' },
  { char: '四', pinyin: 'sì' },
  { char: '是', pinyin: 'shì' },
  { char: '女', pinyin: 'nǚ' },
  { char: '水', pinyin: 'shuǐ' },
  { char: '去', pinyin: 'qù' },
  { char: '来', pinyin: 'lái' },
  { char: '不', pinyin: 'bù' },
  { char: '小', pinyin: 'xiǎo' },
  { char: '少', pinyin: 'shǎo' },
  { char: '牛', pinyin: 'niú' },
  { char: '果', pinyin: 'guǒ' },
  { char: '鸟', pinyin: 'niǎo' },
  { char: '早', pinyin: 'zǎo' },
  { char: '书', pinyin: 'shū' },
  { char: '刀', pinyin: 'dāo' },
  { char: '尺', pinyin: 'chǐ' },
  { char: '本', pinyin: 'běn' },
  { char: '木', pinyin: 'mù' },
  { char: '林', pinyin: 'lín' },
  { char: '土', pinyin: 'tǔ' },
  { char: '力', pinyin: 'lì' },
  { char: '中', pinyin: 'zhōng' },
  { char: '五', pinyin: 'wǔ' },
  { char: '立', pinyin: 'lì' },
  { char: '正', pinyin: 'zhèng' },
  { char: '向', pinyin: 'xiàng' },
  { char: '我', pinyin: 'wǒ' },
  { char: '们', pinyin: 'men' },
  { char: '好', pinyin: 'hǎo' },
  { char: '有', pinyin: 'yǒu' }
]

function shuffleArray(arr) {
  var result = arr.slice()
  for (var i = result.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1))
    var temp = result[i]
    result[i] = result[j]
    result[j] = temp
  }
  return result
}

function generatePinyinQuestions(count, mode, listType) {
  var source = listType === 'xiezi' ? xiezilist : shiziList
  if (source.length < 4) return []

  var questions = []
  var shuffled = shuffleArray(source)

  for (var i = 0; i < Math.min(count, shuffled.length); i++) {
    var item = shuffled[i]
    var options = []

    if (mode === 'char2pinyin') {
      options = generatePinyinOptions(item, source)
      questions.push({
        id: i,
        type: 'char2pinyin',
        prompt: item.char,
        answer: item.pinyin,
        options: options,
        userAnswer: '',
        isCorrect: false
      })
    } else if (mode === 'pinyin2char') {
      options = generateCharOptions(item, source)
      questions.push({
        id: i,
        type: 'pinyin2char',
        prompt: item.pinyin,
        answer: item.char,
        options: options,
        userAnswer: '',
        isCorrect: false
      })
    } else if (mode === 'pinyin2write') {
      questions.push({
        id: i,
        type: 'pinyin2write',
        prompt: item.pinyin,
        answer: item.char,
        options: [],
        userAnswer: '',
        isCorrect: false
      })
    }
  }

  return questions
}

function generatePinyinOptions(correct, source) {
  var options = [correct.pinyin]
  var pool = shuffleArray(source.filter(function (s) {
    return s.pinyin !== correct.pinyin
  }))
  for (var i = 0; i < pool.length && options.length < 4; i++) {
    if (options.indexOf(pool[i].pinyin) < 0) {
      options.push(pool[i].pinyin)
    }
  }
  while (options.length < 4) {
    options.push('---')
  }
  return shuffleArray(options)
}

function generateCharOptions(correct, source) {
  var options = [correct.char]
  var pool = shuffleArray(source.filter(function (s) {
    return s.char !== correct.char
  }))
  for (var i = 0; i < pool.length && options.length < 4; i++) {
    if (options.indexOf(pool[i].char) < 0) {
      options.push(pool[i].char)
    }
  }
  while (options.length < 4) {
    options.push('?')
  }
  return shuffleArray(options)
}

module.exports = {
  shiziList: shiziList,
  xiezilist: xiezilist,
  generatePinyinQuestions: generatePinyinQuestions
}
