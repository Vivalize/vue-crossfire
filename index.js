export default {
	data () {
		return {
			listeners: {},
		}
	},
	methods: {
		crossfire: function (reference, provideID) {
			if (!reference) throw('No firebase reference provided')
			const path = reference.path || reference._query.toString()
			if (!this.listeners[path]) {
				// Construct local data storage
				this.$set(this.listeners, path, {
					doc: null,
					data: null,
					queryData: {},
					queryDocs: [],
					queryDocWatchers: {},
					queryDocSkipUpdate: {},
					ref: reference,
					skipUpdate: true,
					type: reference._delegate.type,
					listener: reference.onSnapshot(doc => {
						if (!doc.metadata.hasPendingWrites) {
							if (reference._delegate.type === 'document') {
								this.listeners[path].skipUpdate = true
								this.listeners[path].doc = doc
								this.listeners[path].data = doc.data()
							} else {
								this.listeners[path].queryDocs = doc.docs
								doc.docs.forEach(d => {
									if (!this.listeners[path].queryDocWatchers[d.id]) {
										// Create watchers for query docs
										this.$set(this.listeners[path].queryDocSkipUpdate, d.id, true)
										this.$set(this.listeners[path].queryDocWatchers, d.id, this.$watch(
											function () { return this.listeners[path].queryData[d.id] },
											function (val) {
												if (!this.listeners[path].queryDocSkipUpdate[d.id]) {
													console.log('updating document', d.id)
													d.ref.update(this.listeners[path].queryData[d.id])
												} else this.listeners[path].queryDocSkipUpdate[d.id] = false
											},
											{ deep: true }
										))
									}
									this.listeners[path].queryDocSkipUpdate[d.id] = true
									this.$set(this.listeners[path].queryData, d.id, d.data())
								})
							}
						}
					}),
				})
				
				// Create watcher for document updates
				this.$set(this.listeners[path], 'watcher', this.$watch(
					function () { return this.listeners[path].data },
					function (val) {
						if (!this.listeners[path].skipUpdate) {
							this.listeners[path].ref.update(this.listeners[path].data)
						} else this.listeners[path].skipUpdate = false
					},
					{ deep: true }
				))
			}
			
			if (this.listeners[path].type === 'document') return this.listeners[path].data
			else {
				if (provideID) return this.listeners[path].queryDocs.map(d => ({ id: d.id, data: this.listeners[path].queryData[d.id] }))
				else return this.listeners[path].queryDocs.map(d => this.listeners[path].queryData[d.id])
			}
		}
	}
}