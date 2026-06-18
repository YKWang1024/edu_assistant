var app = getApp()
var util = require('../../utils/util.js')

Page({
  data: {
    recipeId: '',
    ratingId: null,
    isEdit: false,
    editDate: '',
    recipe: null,
    score: 5,
    comment: '',
    stars: [1, 2, 3, 4, 5],
    familyMembers: [],
    memberRated: {},
    selectedMember: '',
    selectedMemberIndex: 0,
    submitting: false
  },

  onLoad: function (options) {
    if (options.id) this.setData({ recipeId: options.id })
    if (options.ratingId) this.setData({ ratingId: options.ratingId, isEdit: true })
    this.loadMembers()
    this.loadRecipe()
  },

  loadMembers: function () {
    var that = this
    function fallback() {
      var members = ['宝贝', '妈妈', '爸爸']
      try { var m = wx.getStorageSync('familyMembers'); if (m && m.length) members = m } catch (e) {}
      that.setData({ familyMembers: members, selectedMember: members[0], selectedMemberIndex: 0 })
      that.updateMemberRated()
    }
    if (!app.globalData.cloudReady) { fallback(); return }
    app.callCloudFunction('getFamilyInfo', {}, function (res) {
      if (res && res.success && res.data.members && res.data.members.length) {
        var names = res.data.members.map(function (m) { return m.displayName })
        that.setData({ familyMembers: names, selectedMember: names[0], selectedMemberIndex: 0 })
        that.updateMemberRated()
      } else {
        fallback()
      }
    })
  },

  loadRecipe: function () {
    var that = this
    function apply(r) { that.setData({ recipe: r }); that.afterRecipe(r) }
    if (!app.globalData.cloudReady) {
      var cache = []
      try { cache = wx.getStorageSync('recipesCache') || [] } catch (e) {}
      var cr = cache.filter(function (x) { return x._id === that.data.recipeId })[0]
      if (cr) apply(cr)
      return
    }
    app.callCloudFunction('listRecipes', {}, function (res) {
      if (res && res.success) {
        var r = (res.data || []).filter(function (x) { return x._id === that.data.recipeId })[0]
        if (r) apply(r)
      }
    })
  },

  afterRecipe: function (recipe) {
    this.updateMemberRated()
    if (this.data.isEdit && this.data.ratingId) {
      var rid = this.data.ratingId
      var rating = (recipe.ratings || []).filter(function (r) { return r.id === rid })[0]
      if (rating) {
        var idx = this.data.familyMembers.indexOf(rating.memberName)
        this.setData({
          score: rating.score,
          comment: rating.comment || '',
          selectedMember: rating.memberName,
          selectedMemberIndex: idx >= 0 ? idx : this.data.selectedMemberIndex,
          editDate: rating.date
        })
      }
    }
  },

  updateMemberRated: function () {
    var recipe = this.data.recipe
    if (!recipe || !recipe.ratings) { this.setData({ memberRated: {} }); return }
    var active = recipe.ratings.filter(function (r) { return !r.deleted })
    var rated = {}
    this.data.familyMembers.forEach(function (member) {
      var mr = active.filter(function (r) { return r.memberName === member })
      if (mr.length) rated[member] = mr[mr.length - 1].score
    })
    this.setData({ memberRated: rated })
  },

  onSwitchMember: function (e) {
    if (this.data.isEdit) return // 编辑模式锁定成员
    var idx = e.currentTarget.dataset.index
    var member = this.data.familyMembers[idx]
    var rated = this.data.memberRated[member]
    this.setData({ selectedMemberIndex: idx, selectedMember: member, score: rated || 5, comment: '' })
  },

  onSelectScore: function (e) {
    this.setData({ score: e.currentTarget.dataset.score })
  },

  onCommentInput: function (e) {
    this.setData({ comment: e.detail.value })
  },

  onSubmit: function () {
    var that = this
    if (!app.globalData.cloudReady) { wx.showToast({ title: '请联网后再操作', icon: 'none' }); return }

    if (this.data.isEdit) {
      var today = util.getTodayStr()
      if (this.data.editDate && this.data.editDate < today) {
        wx.showModal({
          title: '修改历史评分',
          editable: true,
          placeholderText: '输入“修改”确认',
          content: '该评分是 ' + this.data.editDate + ' 的历史记录，修改请输入“修改”二字确认。',
          success: function (m) {
            if (m.confirm && (m.content || '').trim() === '修改') that.doEdit(true)
            else if (m.confirm) wx.showToast({ title: '未输入“修改”，已取消', icon: 'none' })
          }
        })
      } else {
        this.doEdit(false)
      }
      return
    }

    this.setData({ submitting: true })
    app.callCloudFunction('rateRecipe', {
      recipeId: this.data.recipeId,
      score: this.data.score,
      comment: this.data.comment.trim(),
      memberName: this.data.selectedMember
    }, function (res) {
      that.setData({ submitting: false })
      if (res && res.success) {
        wx.showToast({ title: '评分成功', icon: 'success' })
        setTimeout(function () { wx.navigateBack() }, 1200)
      } else {
        wx.showToast({ title: (res && res.message) || '评分失败', icon: 'none' })
      }
    })
  },

  doEdit: function (confirmBeforeToday) {
    var that = this
    that.setData({ submitting: true })
    app.callCloudFunction('editRating', {
      recipeId: this.data.recipeId,
      ratingId: this.data.ratingId,
      score: this.data.score,
      comment: this.data.comment.trim(),
      confirmBeforeToday: confirmBeforeToday
    }, function (res) {
      that.setData({ submitting: false })
      if (res && res.success) {
        wx.showToast({ title: '已修改', icon: 'success' })
        setTimeout(function () { wx.navigateBack() }, 1200)
      } else {
        wx.showToast({ title: (res && res.message) || '修改失败', icon: 'none' })
      }
    })
  }
})
