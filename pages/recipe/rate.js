var util = require('../../utils/util.js')

Page({
  data: {
    recipeId: null,
    recipe: null,
    score: 5,
    comment: '',
    stars: [1, 2, 3, 4, 5],
    familyMembers: [],
    memberRated: {},
    selectedMember: '',
    selectedMemberIndex: 0
  },

  onLoad: function (options) {
    if (options.id) {
      this.setData({ recipeId: parseFloat(options.id) })
      this.loadRecipe()
    }
    this.loadFamilyMembers()
  },

  loadFamilyMembers: function () {
    try {
      var members = wx.getStorageSync('familyMembers')
      if (!members || members.length === 0) {
        members = ['宝贝', '妈妈', '爸爸']
        wx.setStorageSync('familyMembers', members)
      }
      this.setData({
        familyMembers: members,
        selectedMember: members[0],
        selectedMemberIndex: 0
      })
      this.updateMemberRated()
    } catch (e) {
      this.setData({
        familyMembers: ['宝贝', '妈妈', '爸爸'],
        selectedMember: '宝贝',
        selectedMemberIndex: 0
      })
    }
  },

  updateMemberRated: function () {
    var recipe = this.data.recipe
    if (!recipe || !recipe.ratings) {
      this.setData({ memberRated: {} })
      return
    }
    var rated = {}
    this.data.familyMembers.forEach(function (member) {
      var memberRatings = recipe.ratings.filter(function (r) {
        return r.member === member
      })
      if (memberRatings.length > 0) {
        var lastRating = memberRatings[memberRatings.length - 1]
        rated[member] = lastRating.score
      }
    })
    this.setData({ memberRated: rated })
  },

  onSwitchMember: function (e) {
    var idx = e.currentTarget.dataset.index
    var member = this.data.familyMembers[idx]
    var rated = this.data.memberRated[member]
    this.setData({
      selectedMemberIndex: idx,
      selectedMember: member,
      score: rated || 5,
      comment: ''
    })
  },

  loadRecipe: function () {
    try {
      var recipes = wx.getStorageSync('recipes') || []
      var id = this.data.recipeId
      var recipe = recipes.find(function (r) { return r.id === id })
      if (recipe) {
        this.setData({ recipe: recipe })
        this.updateMemberRated()
      }
    } catch (e) {}
  },

  onSelectScore: function (e) {
    var score = e.currentTarget.dataset.score
    this.setData({ score: score })
  },

  onCommentInput: function (e) {
    this.setData({ comment: e.detail.value })
  },

  onSubmit: function () {
    var that = this
    try {
      var recipes = wx.getStorageSync('recipes') || []
      var id = that.data.recipeId
      var recipeIndex = -1
      recipes.forEach(function (r, i) {
        if (r.id === id) recipeIndex = i
      })

      if (recipeIndex < 0) {
        wx.showToast({ title: '菜谱不存在', icon: 'none' })
        return
      }

      var rating = {
        score: that.data.score,
        comment: that.data.comment.trim(),
        member: that.data.selectedMember,
        date: util.getTodayStr(),
        time: util.formatTime(new Date())
      }

      if (!recipes[recipeIndex].ratings) {
        recipes[recipeIndex].ratings = []
      }
      recipes[recipeIndex].ratings.push(rating)

      var totalScore = 0
      recipes[recipeIndex].ratings.forEach(function (r) {
        totalScore += r.score
      })
      recipes[recipeIndex].avgScore = Math.round((totalScore / recipes[recipeIndex].ratings.length) * 10) / 10

      var memberScores = {}
      recipes[recipeIndex].ratings.forEach(function (r) {
        if (!memberScores[r.member]) {
          memberScores[r.member] = { total: 0, count: 0 }
        }
        memberScores[r.member].total += r.score
        memberScores[r.member].count += 1
      })
      var memberAvg = {}
      Object.keys(memberScores).forEach(function (m) {
        memberAvg[m] = Math.round((memberScores[m].total / memberScores[m].count) * 10) / 10
      })
      recipes[recipeIndex].memberAvgScores = memberAvg

      wx.setStorageSync('recipes', recipes)

      wx.showToast({ title: '评分成功', icon: 'success' })
      setTimeout(function () {
        wx.navigateBack()
      }, 1500)
    } catch (e) {
      wx.showToast({ title: '评分失败', icon: 'none' })
    }
  }
})
