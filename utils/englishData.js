var vocabulary = {
  food: {
    name: '食物',
    icon: '🍚',
    words: [
      { en: 'rice', cn: '米饭' },
      { en: 'bread', cn: '面包' },
      { en: 'noodles', cn: '面条' },
      { en: 'egg', cn: '鸡蛋' },
      { en: 'tomato', cn: '番茄' },
      { en: 'carrot', cn: '胡萝卜' },
      { en: 'milk', cn: '牛奶' }
    ]
  },
  classroom: {
    name: '教室',
    icon: '🏫',
    words: [
      { en: 'door', cn: '门' },
      { en: 'window', cn: '窗户' },
      { en: 'desk', cn: '课桌' },
      { en: 'chair', cn: '椅子' },
      { en: 'blackboard', cn: '黑板' },
      { en: 'schoolbag', cn: '书包' }
    ]
  },
  play: {
    name: '运动',
    icon: '🛹',
    words: [
      { en: 'skateboard', cn: '滑板' },
      { en: 'rollerblade', cn: '轮滑鞋' }
    ]
  },
  season: {
    name: '季节',
    icon: '🌸',
    words: [
      { en: 'spring', cn: '春天' },
      { en: 'summer', cn: '夏天' },
      { en: 'autumn', cn: '秋天' },
      { en: 'winter', cn: '冬天' },
      { en: 'warm', cn: '温暖的' },
      { en: 'hot', cn: '热的' },
      { en: 'cool', cn: '凉爽的' },
      { en: 'cold', cn: '冷的' }
    ]
  },
  fruit: {
    name: '水果',
    icon: '🍎',
    words: [
      { en: 'apple', cn: '苹果' },
      { en: 'banana', cn: '香蕉' },
      { en: 'pear', cn: '梨' },
      { en: 'peach', cn: '桃子' },
      { en: 'lemon', cn: '柠檬' },
      { en: 'pineapple', cn: '菠萝' },
      { en: 'watermelon', cn: '西瓜' }
    ]
  },
  animal: {
    name: '动物',
    icon: '🐸',
    words: [
      { en: 'frog', cn: '青蛙' },
      { en: 'rabbit', cn: '兔子' },
      { en: 'bee', cn: '蜜蜂' },
      { en: 'bird', cn: '小鸟' },
      { en: 'cat', cn: '猫' },
      { en: 'dog', cn: '狗' },
      { en: 'sheep', cn: '绵羊' },
      { en: 'hen', cn: '母鸡' }
    ]
  }
}

var sentencePatterns = [
  { pattern: 'What food do you like?', answer: 'I like rice.', options: ['I like rice.', 'I see rice.', 'I hear rice.', 'I have rice.'], category: 'food' },
  { pattern: 'What food do you like?', answer: 'I like noodles.', options: ['I like noodles.', 'I see noodles.', 'I am noodles.', 'I have noodles.'], category: 'food' },
  { pattern: 'I like bread ___ breakfast.', answer: 'for', options: ['for', 'in', 'on', 'at'], category: 'food' },
  { pattern: 'What do we do in the classroom?', answer: 'We read books.', options: ['We read books.', 'We eat rice.', 'We swim.', 'We sleep.'], category: 'classroom' },
  { pattern: 'What do we do in the classroom?', answer: 'We write on the blackboard.', options: ['We write on the blackboard.', 'We run on the blackboard.', 'We eat the blackboard.', 'We sleep on the blackboard.'], category: 'classroom' },
  { pattern: 'Open the ___, please.', answer: 'door', options: ['door', 'desk', 'chair', 'milk'], category: 'classroom' },
  { pattern: 'Close the ___, please.', answer: 'window', options: ['window', 'desk', 'rice', 'egg'], category: 'classroom' },
  { pattern: 'Which season do you like?', answer: 'I like spring.', options: ['I like spring.', 'I see spring.', 'I am spring.', 'I hear spring.'], category: 'season' },
  { pattern: 'Which season do you like?', answer: 'I like summer.', options: ['I like summer.', 'I see summer.', 'I am summer.', 'I have summer.'], category: 'season' },
  { pattern: 'In spring, it is ___.', answer: 'warm', options: ['warm', 'hot', 'cold', 'cool'], category: 'season' },
  { pattern: 'In summer, it is ___.', answer: 'hot', options: ['hot', 'warm', 'cool', 'cold'], category: 'season' },
  { pattern: 'In autumn, it is ___.', answer: 'cool', options: ['cool', 'hot', 'warm', 'cold'], category: 'season' },
  { pattern: 'In winter, it is ___.', answer: 'cold', options: ['cold', 'hot', 'warm', 'cool'], category: 'season' },
  { pattern: 'What do you know about fruit?', answer: 'Apples are sweet.', options: ['Apples are sweet.', 'Apples are hot.', 'Apples are cold.', 'Apples are cool.'], category: 'fruit' },
  { pattern: 'A ___ is yellow and sour.', answer: 'lemon', options: ['lemon', 'apple', 'watermelon', 'peach'], category: 'fruit' },
  { pattern: 'A ___ is big and green outside, red inside.', answer: 'watermelon', options: ['watermelon', 'apple', 'lemon', 'peach'], category: 'fruit' },
  { pattern: 'How do animals grow?', answer: 'A tadpole grows into a frog.', options: ['A tadpole grows into a frog.', 'A tadpole grows into a bird.', 'A tadpole grows into a bee.', 'A tadpole grows into a rabbit.'], category: 'animal' },
  { pattern: 'What do you see?', answer: 'I see a frog.', options: ['I see a frog.', 'I hear a frog.', 'I like a frog.', 'I eat a frog.'], category: 'animal' },
  { pattern: 'What do you hear?', answer: 'I hear a cat.', options: ['I hear a cat.', 'I see a cat.', 'I like a cat.', 'I eat a cat.'], category: 'animal' }
]

var confusionGroups = [
  { words: ['rice', 'noodles'], tip: 'rice是米饭，noodles是面条，都是主食但不同' },
  { words: ['bread', 'egg'], tip: 'bread是面包，egg是鸡蛋，早餐常吃但不一样' },
  { words: ['desk', 'chair'], tip: 'desk是课桌，chair是椅子，桌子坐椅子' },
  { words: ['window', 'door'], tip: 'window是窗户，door是门，窗户看外面，门走出去' },
  { words: ['spring', 'summer'], tip: 'spring春天暖warm，summer夏天热hot' },
  { words: ['autumn', 'winter'], tip: 'autumn秋天凉cool，winter冬天冷cold' },
  { words: ['warm', 'hot'], tip: 'warm温暖，hot更热，夏天hot，春天warm' },
  { words: ['cool', 'cold'], tip: 'cool凉爽，cold更冷，秋天cool，冬天cold' },
  { words: ['apple', 'pineapple'], tip: 'apple是苹果，pineapple是菠萝，名字里都有apple但完全不同' },
  { words: ['peach', 'pear'], tip: 'peach是桃子，pear是梨，都是水果但形状不同' },
  { words: ['frog', 'rabbit'], tip: 'frog青蛙会跳，rabbit兔子也跳，但青蛙住水边' },
  { words: ['bee', 'bird'], tip: 'bee蜜蜂会飞采蜜，bird小鸟会飞唱歌' },
  { words: ['cat', 'hen'], tip: 'cat猫喵喵叫，hen母鸡下蛋咯咯叫' },
  { words: ['see', 'hear'], tip: 'see是用眼睛看，hear是用耳朵听' }
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

function getAllWords() {
  var all = []
  Object.keys(vocabulary).forEach(function (key) {
    vocabulary[key].words.forEach(function (w) {
      all.push({ en: w.en, cn: w.cn, category: key })
    })
  })
  return all
}

function generateEn2CnQuestions(count) {
  var all = shuffleArray(getAllWords())
  var questions = []
  var used = {}
  for (var i = 0; i < all.length && questions.length < count; i++) {
    var word = all[i]
    if (used[word.en]) continue
    used[word.en] = true
    var wrongOptions = shuffleArray(getAllWords().filter(function (w) {
      return w.en !== word.en && w.cn !== word.cn
    })).slice(0, 3).map(function (w) { return w.cn })
    while (wrongOptions.length < 3) {
      wrongOptions.push('???')
    }
    var options = shuffleArray([word.cn].concat(wrongOptions))
    questions.push({
      type: 'en2cn',
      prompt: word.en,
      answer: word.cn,
      options: options,
      category: word.category
    })
  }
  return questions
}

function generateCn2EnQuestions(count) {
  var all = shuffleArray(getAllWords())
  var questions = []
  var used = {}
  for (var i = 0; i < all.length && questions.length < count; i++) {
    var word = all[i]
    if (used[word.en]) continue
    used[word.en] = true
    var wrongOptions = shuffleArray(getAllWords().filter(function (w) {
      return w.en !== word.en
    })).slice(0, 3).map(function (w) { return w.en })
    while (wrongOptions.length < 3) {
      wrongOptions.push('???')
    }
    var options = shuffleArray([word.en].concat(wrongOptions))
    questions.push({
      type: 'cn2en',
      prompt: word.cn,
      answer: word.en,
      options: options,
      category: word.category
    })
  }
  return questions
}

function generateSentenceQuestions(count) {
  var all = shuffleArray(sentencePatterns)
  var questions = []
  for (var i = 0; i < all.length && questions.length < count; i++) {
    var s = all[i]
    questions.push({
      type: 'sentence',
      prompt: s.pattern,
      answer: s.answer,
      options: s.options,
      category: s.category
    })
  }
  return questions
}

function generateConfusionQuestions(count) {
  var groups = shuffleArray(confusionGroups)
  var questions = []
  for (var i = 0; i < groups.length && questions.length < count; i++) {
    var group = groups[i]
    var word1 = null
    var word2 = null
    getAllWords().forEach(function (w) {
      if (w.en === group.words[0]) word1 = w
      if (w.en === group.words[1]) word2 = w
    })
    if (!word1 || !word2) continue

    questions.push({
      type: 'confusion',
      prompt: group.tip + '\n哪个是 ' + group.words[0] + ' 的意思？',
      answer: word1.cn,
      options: shuffleArray([word1.cn, word2.cn]),
      category: word1.category,
      tip: group.tip
    })
  }
  return questions
}

function generateEnglishQuestions(count, mode) {
  if (mode === 'en2cn') return generateEn2CnQuestions(count)
  if (mode === 'cn2en') return generateCn2EnQuestions(count)
  if (mode === 'sentence') return generateSentenceQuestions(count)
  if (mode === 'confusion') return generateConfusionQuestions(count)

  var en2cn = generateEn2CnQuestions(Math.ceil(count / 4))
  var cn2en = generateCn2EnQuestions(Math.ceil(count / 4))
  var sentence = generateSentenceQuestions(Math.ceil(count / 4))
  var confusion = generateConfusionQuestions(count - en2cn.length - cn2en.length - sentence.length)
  var all = shuffleArray(en2cn.concat(cn2en).concat(sentence).concat(confusion))
  return all.slice(0, count)
}

module.exports = {
  vocabulary: vocabulary,
  sentencePatterns: sentencePatterns,
  confusionGroups: confusionGroups,
  generateEnglishQuestions: generateEnglishQuestions
}
