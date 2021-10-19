import { updateDoc, onSnapshot } from 'firebase/firestore'

// Function that handles updating a doc that's changed
function updateData (oldData, data, ref, options) {
	if (options && options.readOnly) return
	if (data === null) return
	let update = JSON.parse(JSON.stringify(data))
	if (options && options.ignoreUnchangedFields) {
		const keys = Object.keys(update)
		keys.forEach(k => {
			if (objectsAreEqual(update[k], oldData[k])) delete update[k]
		})
	}
	if (options && options.transformUpdate) update = options.transformUpdate(update)
	return updateDoc(ref, update)
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

export default {
	install (Vue, options) {
		const crossfireListeners = Vue.observable({})

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
		Vue.prototype.$crossfire = function (reference, options) {
			if (!reference) return
			const path = reference.path || reference._query.toString()
			if (!crossfireListeners[path]) {
				// Construct local data storage
				this.$set(crossfireListeners, path, {
					doc: null,
					data: null,
					oldData: null,
					queryDocs: [],
					queryData: {},
					queryOldData: {},
					queryDocWatchers: {},
					queryDocSkipUpdate: {},
					ref: reference,
					skipUpdate: true,
					type: reference.type,
					listener: onSnapshot(reference, doc => {
						// Ignore document updates triggered by the client
						if (!doc.metadata.hasPendingWrites) {

							// Setup single listener if reference is a document
						if (reference.type === 'document') {
							crossfireListeners[path].skipUpdate = true
							crossfireListeners[path].doc = doc
							crossfireListeners[path].data = doc.data()
							crossfireListeners[path].oldData = JSON.parse(JSON.stringify(doc.data()))
						}
						
						// If reference is a query or collection, setup listeners for every document within
						else {
							crossfireListeners[path].queryDocs = doc.docs
							doc.docs.forEach(d => {
								if (!crossfireListeners[path].queryDocWatchers[d.id]) {

									// Create watchers for every doc
									this.$set(crossfireListeners[path].queryDocSkipUpdate, d.id, true)
									this.$set(crossfireListeners[path].queryDocWatchers, d.id, this.$watch(
										function () { return crossfireListeners[path].queryData[d.id] },
										function (val) {
											if (!crossfireListeners[path].queryDocSkipUpdate[d.id]) updateData(crossfireListeners[path].queryOldData[d.id], crossfireListeners[path].queryData[d.id], d.ref, options)
											else crossfireListeners[path].queryDocSkipUpdate[d.id] = false
											crossfireListeners[path].queryOldData[d.id] = JSON.parse(JSON.stringify(crossfireListeners[path].queryData[d.id]))
										},
										{ deep: true }
									))
								}

								
								crossfireListeners[path].queryDocSkipUpdate[d.id] = true
								this.$set(crossfireListeners[path].queryData, d.id, d.data())
								this.$set(crossfireListeners[path].queryOldData, d.id, JSON.parse(JSON.stringify(d.data())))
							})
						}
						}
					}),
				})
				
				// Create watcher for document updates
				this.$set(crossfireListeners[path], 'watcher', this.$watch(
					function () { return crossfireListeners[path].data },
					function (val) {
						if (!crossfireListeners[path].skipUpdate) updateData(crossfireListeners[path].oldData, crossfireListeners[path].data, crossfireListeners[path].ref, options)
						else crossfireListeners[path].skipUpdate = false
						crossfireListeners[path].oldData = JSON.parse(JSON.stringify(crossfireListeners[path].data))
					},
					{ deep: true }
				))
			}

			// Return the firebase data associated with the passed reference
			if (crossfireListeners[path].type === 'document') {
				if (options && options.provideID) {
					return { id: crossfireListeners[path].doc.id, data: crossfireListeners[path].data }
				} else return crossfireListeners[path].data
			} else {
				if (options && options.provideID) {
					return crossfireListeners[path].queryDocs.map(d => {
						return { id: d.id, data: crossfireListeners[path].queryData[d.id] }
					})
				} else {
					return crossfireListeners[path].queryDocs.map(d => crossfireListeners[path].queryData[d.id])
				}
			}
		}
	},
}