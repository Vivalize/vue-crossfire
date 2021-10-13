export default {
	data () {
		return {
			crossfireListeners: {},
		}
	},
	methods: {
		// Returns the data located in Firestore at the passed in "reference" parameter
		// This method is meant to be used reactively in Vue, as the returned result will
		// change based on listening state (will return null on first call, but will return
		// the actual data once the first request is completed). All data returned will be
		// watched by Vue, so that if it is changed, it will be updated back in Firestore.
		// Passing in a document reference will just return that document's data, but passing
		// in a collection/query reference will return the resulting documents' data in an array
		//
		// Available options:
		//		provideID:
		//			Instead of just returning "data" for the document/documents,
		//			it will return { id: <document ID>, data: <document data> }
		//		transformUpdate:
		//			When a document is about to be updated in firestore because of
		//			local changes, this function will be run on the data first
		crossfire: function (reference, options) {
			if (!reference) return
			const path = reference.path || reference._query.toString()
			if (!this.crossfireListeners[path]) {
				// Construct local data storage
				this.$set(this.crossfireListeners, path, {
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

						// Ignore document updates triggered by the client
						if (!doc.metadata.hasPendingWrites) {

							// Setup single listener if reference is a document
							if (reference._delegate.type === 'document') {
								this.crossfireListeners[path].skipUpdate = true
								this.crossfireListeners[path].doc = doc
								this.crossfireListeners[path].data = doc.data()
							}
							
							// If reference is a query or collection, setup listeners for every document within
							else {
								this.crossfireListeners[path].queryDocs = doc.docs
								doc.docs.forEach(d => {
									if (!this.crossfireListeners[path].queryDocWatchers[d.id]) {

										// Create watchers for every doc
										this.$set(this.crossfireListeners[path].queryDocSkipUpdate, d.id, true)
										this.$set(this.crossfireListeners[path].queryDocWatchers, d.id, this.$watch(
											function () { return this.crossfireListeners[path].queryData[d.id] },
											function (val) {
												if (!this.crossfireListeners[path].queryDocSkipUpdate[d.id]) this.updateDoc(this.crossfireListeners[path].queryData[d.id], d.ref, options)
												else this.crossfireListeners[path].queryDocSkipUpdate[d.id] = false
											},
											{ deep: true }
										))
									}
									this.crossfireListeners[path].queryDocSkipUpdate[d.id] = true
									this.$set(this.crossfireListeners[path].queryData, d.id, d.data())
								})
							}
						}
					}),
				})
				
				// Create watcher for document updates
				this.$set(this.crossfireListeners[path], 'watcher', this.$watch(
					function () { return this.crossfireListeners[path].data },
					function (val) {
						if (!this.crossfireListeners[path].skipUpdate) this.updateDoc(this.crossfireListeners[path].data, this.crossfireListeners[path].ref, options)
						else this.crossfireListeners[path].skipUpdate = false
					},
					{ deep: true }
				))
			}

			// Return the firebase data associated with the passed reference
			if (this.crossfireListeners[path].type === 'document') {
				if (options && options.provideID) {
					return { id: this.crossfireListeners[path].doc.id, data: this.crossfireListeners[path].data }
				} else return this.crossfireListeners[path].data
			} else {
				if (options && options.provideID) {
					return this.crossfireListeners[path].queryDocs.map(d => {
						return { id: d.id, data: this.crossfireListeners[path].queryData[d.id] }
					})
				} else {
					return this.crossfireListeners[path].queryDocs.map(d => this.crossfireListeners[path].queryData[d.id])
				}
			}
		},
		// Function that handles updating a doc that's changed
		updateDoc: function (data, ref, options) {
			let update = Object.assign({}, data)
			if (options && options.transformUpdate) update = options.transformUpdate(update)
			if (!(options && options.readOnly)) ref.update(update)
		},
	}
}