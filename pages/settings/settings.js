Page({
  data: {
    familyMembers: [],
    newMemberName: '',
    editingIndex: -1,
    editingName: ''
  },

  onLoad: function () {
    this.loadFamilyMembers()
  },

  loadFamilyMembers: function () {
    try {
      var members = wx.getStorageSync('familyMembers')
      if (!members || members.length === 0) {
        members = ['宝贝', '妈妈', '爸爸']
        wx.setStorageSync('familyMembers', members)
      }
      this.setData({ familyMembers: members })
    } catch (e) {
      this.setData({ familyMembers: ['宝贝', '妈妈', '爸爸'] })
    }
  },

  onNewMemberInput: function (e) {
    this.setData({ newMemberName: e.detail.value })
  },

  onAddMember: function () {
    var name = this.data.newMemberName.trim()
    if (!name) {
      wx.showToast({ title: '请输入成员名称', icon: 'none' })
      return
    }
    if (this.data.familyMembers.indexOf(name) >= 0) {
      wx.showToast({ title: '成员已存在', icon: 'none' })
      return
    }
    var members = this.data.familyMembers.concat([name])
    this.setData({
      familyMembers: members,
      newMemberName: ''
    })
    try { wx.setStorageSync('familyMembers', members) } catch (e) {}
  },

  onEditMember: function (e) {
    var idx = e.currentTarget.dataset.index
    this.setData({
      editingIndex: idx,
      editingName: this.data.familyMembers[idx]
    })
  },

  onEditingInput: function (e) {
    this.setData({ editingName: e.detail.value })
  },

  onSaveEdit: function () {
    var name = this.data.editingName.trim()
    var idx = this.data.editingIndex
    if (!name) {
      wx.showToast({ title: '名称不能为空', icon: 'none' })
      return
    }
    var oldName = this.data.familyMembers[idx]
    if (name === oldName) {
      this.setData({ editingIndex: -1, editingName: '' })
      return
    }
    if (this.data.familyMembers.indexOf(name) >= 0) {
      wx.showToast({ title: '成员已存在', icon: 'none' })
      return
    }

    var members = this.data.familyMembers.slice()
    members[idx] = name

    try {
      var recipes = wx.getStorageSync('recipes') || []
      recipes.forEach(function (recipe) {
        if (recipe.ratings) {
          recipe.ratings.forEach(function (r) {
            if (r.member === oldName) {
              r.member = name
            }
          })
        }
        if (recipe.memberAvgScores) {
          if (recipe.memberAvgScores[oldName] !== undefined) {
            recipe.memberAvgScores[name] = recipe.memberAvgScores[oldName]
            delete recipe.memberAvgScores[oldName]
          }
        }
      })
      wx.setStorageSync('recipes', recipes)
    } catch (e) {}

    this.setData({
      familyMembers: members,
      editingIndex: -1,
      editingName: ''
    })
    try { wx.setStorageSync('familyMembers', members) } catch (e) {}
    wx.showToast({ title: '修改成功', icon: 'success' })
  },

  onCancelEdit: function () {
    this.setData({ editingIndex: -1, editingName: '' })
  },

  onRemoveMember: function (e) {
    var idx = e.currentTarget.dataset.index
    if (this.data.familyMembers.length <= 1) {
      wx.showToast({ title: '至少保留一个成员', icon: 'none' })
      return
    }
    var members = this.data.familyMembers.slice()
    members.splice(idx, 1)
    this.setData({ familyMembers: members })
    try { wx.setStorageSync('familyMembers', members) } catch (e) {}
  }
})
