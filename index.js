import Vue from 'vue'
import { updateDoc, onSnapshot } from 'firebase/firestore'

// Generate Firebase update data that only updates changed fields of two objects
// Changed object fields more than a level deep will be inserted in Firebase's <l1>.<l2>.<l3> subfield syntax
function createDifferingUpdateData (oldData, newData) {
  const updateData = {}
  Object.keys(newData).forEach(k => {
    if (!objectsAreEqual(oldData[k], newData[k])) {
      if (oldData[k] && newData[k] && typeof newData[k] === 'object' && !Array.isArray(newData[k])) {
        const subfields = createDifferingUpdateData(oldData[k], newData[k])
        Object.keys(subfields).forEach(s => {
          updateData[k + '.' + s] = subfields[s]
        })
      } else {
        updateData[k] = newData[k]
      }
    }
  })
  return updateData
}

// Non-extensive object comparison function
function objectsAreEqual (a, b) {
  if ((a !== null && typeof a === 'object') && (b !== null && typeof b === 'object')) {
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])]
    for (var i = 0; i < keys.length; i++) {
      if (!objectsAreEqual(a[keys[i]], b[keys[i]])) return false
    }
    return true
  } else if ((a !== null && typeof a === 'object') || (b !== null && typeof b === 'object')) {
    return false
  } else {
    return a === b
  }
}

// Deep copy an object
function deepCopy (obj) {
  if (typeof obj !== 'object') return obj
  return JSON.parse(JSON.stringify(obj))
}

// Function that handles updating a doc that's changed
function updateData (reference, data, oldData, options) {
  if (options.readOnly) return
  if (!data) return

  // Create update data
  let update = options.ignoreUnchangedFields ? createDifferingUpdateData(oldData, data) : deepCopy(data)
  if (options.transformUpdate) update = options.transformUpdate(update)

  // Update the doc
  if (options.onUpdate) options.onUpdate(update, reference)
  return updateDoc(reference, update).catch(options.onError)
}

class Crossfire {
  constructor (reference, options) {
    this._vue = new Vue({
      data: function () {
        return {
          data: undefined,
          id: undefined,
          metadata: undefined,
          error: undefined,
          loading: true,
          exists: undefined,
          oldData: undefined,
          listener: null,
          skipUpdate: true,
          downloadSkips: 0,
          reference,
          options: options || {},
        }
      },
      watch: {
        reference: {
          immediate: true,
          handler: function (val) {
            // Reset data
            this.data = undefined
            this.id = undefined
            this.metadata = undefined
            this.error = undefined
            this.loading = undefined
            this.exists = undefined

            // Reset listener and helpers
            this.oldData = undefined
            this.skipUpdate = true
            this.downloadSkips = 0
            if (this.listener) this.listener()

            // Start listening
            this.listener = onSnapshot(val, this.handleNewData, this.handleError)
          }
        },
        data: {
          immediate: true,
          deep: true,
          handler: function (data) {
            if (!this.skipUpdate) {
              this.downloadSkips++
              updateData(this.reference, this.data, this.oldData, this.options)
            } else this.skipUpdate = false
            this.oldData = deepCopy(data)
          },
        },
      },
      destroyed () {
        if (this.listener) this.listener()
      },
      methods: {
        // Handle data listening errors
        handleError: function (error) {
          this.data = undefined
          this.id = undefined
          this.metadata = undefined
          this.error = error
          this.loading = false
          this.exists = undefined
        },

        // Handle new incoming data from firebase
        handleNewData: function (snap) {
          // Ignore document updates triggered by the client
          if (this.downloadSkips <= 0) {
            if (this.options.onDownload) this.options.onDownload(snap)
            this.skipUpdate = true

            // Update resultant data
            this.data = snap.data() || null
            this.id = snap.id
            this.metadata = snap.metadata
            this.error = undefined
            this.loading = false
            this.exists = snap.exists

            // Keep track of old data for future comparisons
            this.oldData = deepCopy(this.data)
          } else this.downloadSkips--
        },
      },
    })
  }

  get metadata () {
    return this._vue.metadata
  }

  get data () {
    return function () {
      return this._vue.data
    }
  }

  get flata () {
    return this._vue.data
  }

  destroy () {
    this._vue.$destroy()
  }
}

class CrossfireQuery {
  constructor (reference, options) {
    this._vue = new Vue({
      data: function () {
        return {
          ids: null,
          data: {},
          oldData: {},
          metadata: {},
          watchers: {},
          references: {},
          error: undefined,
          loading: true,
          listener: null,
          skipUpdate: true,
          downloadSkips: 0,
          reference,
          options: options || {},
        }
      },
      watch: {
        reference: {
          immediate: true,
          handler: function (val) {
            // Reset data
            this.resetDocs()
            this.error = undefined
            this.loading = true

            // Reset listener and helpers
            this.skipUpdate = true
            this.downloadSkips = 0
            if (this.listener) this.listener()

            // Start listening
            this.listener = onSnapshot(val, this.handleNewData, this.handleError)
          }
        },
      },
      destroyed () {
        if (this.listener) this.listener()
      },
      methods: {
        resetDocs: function () {
          Object.values(this.watchers).forEach(watcher => watcher())
          this.ids = null
          this.data = {}
          this.oldData = {}
          this.metadata = {}
          this.watchers = {}
          this.references = {}
        },

        // Handle data listening errors
        handleError: function (error) {
          this.resetDocs()
          this.error = error
          this.loading = false
        },

        // Handle new incoming data from firebase
        handleNewData: function (snap) {
          // Ignore document updates triggered by the client
          if (this.downloadSkips <= 0) {
            if (this.options.onDownload) this.options.onDownload(snap)
            this.skipUpdate = true

            this.ids = snap.docs.map(doc => doc.id)
            this.error = undefined
            this.loading = false

            // Keep track of individual documents
            snap.docChanges().forEach((change) => {
              if (change.type === "added") {
                this.$set(this.data, change.doc.id, change.doc.data() || null)
                this.$set(this.oldData, change.doc.id, deepCopy(this.data[change.doc.id]))
                this.$set(this.metadata, change.doc.id, change.doc.metadata)
                this.$set(this.references, change.doc.id, change.doc.ref)
                this.$set(this.watchers, change.doc.id, this.$watch(
                  'data.' + change.doc.id,
                  function (val) {
                    if (!this.skipUpdate) {
                      this.downloadSkips++
                      updateData(this.references[change.doc.id], this.data[change.doc.id], this.oldData[change.doc.id], this.options)
                    } else this.skipUpdate = false
                    this.oldData[change.doc.id] = deepCopy(val)
                  },
                  { deep: true },
                ))
              }
              if (change.type === "modified") {
                this.data[change.doc.id] = change.doc.data() || null
                this.oldData[change.doc.id] = deepCopy(this.data[change.doc.id])
                this.metadata[change.doc.id] = change.doc.metadata
                this.references[change.doc.id] = change.doc.ref
              }
              if (change.type === "removed") {
                this.watchers[change.doc.id]()
                this.$delete(this.watchers, change.doc.id)
                this.$delete(this.data, change.doc.id)
                this.$delete(this.oldData, change.doc.id)
                this.$delete(this.metadata, change.doc.id)
                this.$delete(this.references, change.doc.id)
              }
            })
          } else this.downloadSkips--
        },
      },
    })
  }

  get metadata () {
    return this._vue.metadata
  }
  get docs () {
    const data = this._vue.data
    return this._vue.ids ? this._vue.ids.map(id => ({
      id,
      data: function () { return data[id] },
      metadata: this._vue.metadata[id],
    })) : null
  }

  destroy () {
    this._vue.$destroy()
  }
}

export default function crossfire (reference, options) {
  if (!reference) throw new Error('No reference provided')
  const cfClass = reference.type === 'document' ? Crossfire : CrossfireQuery
  return new cfClass(reference, options)
}