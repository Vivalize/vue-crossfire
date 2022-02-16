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

// Function that handles updating a doc that's changed
function updateData (oldData, data, ref, options) {
	if (options && options.readOnly) return
	if (data === null) return

	let update
	if (options && options.ignoreUnchangedFields) update = createDifferingUpdateData(oldData, data)
	else update = JSON.parse(JSON.stringify(data))

	if (options && options.transformUpdate) update = options.transformUpdate(update)
	if (options && options.onUpdate) options.onUpdate(update, ref)
	return updateDoc(ref, update).catch(options ? options.onError : null)
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

function getPath (reference) {
	return reference.path || reference._query.toString()
}

export default {
	install (Vue) {
		const cfData = Vue.observable({})

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
			const path = getPath(reference)
			if (!cfData[path]) {
				// Construct local data storage
				this.$set(cfData, path, {
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
					downloadSkips: 0,
					type: reference.type,
					listener: onSnapshot(reference, doc => {
						// Ignore document updates triggered by the client
						if (cfData[path].downloadSkips <= 0) {

							// Setup single listener if reference is a document
							if (reference.type === 'document') {
								if (options && options.onDownload) options.onDownload(doc)
								cfData[path].skipUpdate = true
								cfData[path].doc = doc
								cfData[path].data = doc.data() || null
								cfData[path].oldData = JSON.parse(JSON.stringify(doc.data() || null))
							}
							
							// If reference is a query or collection, setup listeners for every document within
							else {
								if (options && options.onDownload) options.onDownload(doc.docs)
								cfData[path].queryDocs = doc.docs
								doc.docs.forEach(d => {
									if (!cfData[path].queryDocWatchers[d.id]) {

										// Create watchers for every doc
										this.$set(cfData[path].queryDocSkipUpdate, d.id, true)
										this.$set(cfData[path].queryDocWatchers, d.id, this.$watch(
											function () { return cfData[path].queryData[d.id] },
											function (val) {
												if (!cfData[path].queryDocSkipUpdate[d.id]) {
													cfData[path].downloadSkips++
													updateData(cfData[path].queryOldData[d.id], cfData[path].queryData[d.id], d.ref, options)
												} else cfData[path].queryDocSkipUpdate[d.id] = false
												cfData[path].queryOldData[d.id] = JSON.parse(JSON.stringify(cfData[path].queryData[d.id]))
											},
											{ deep: true }
										))
									}

									
									cfData[path].queryDocSkipUpdate[d.id] = true
									this.$set(cfData[path].queryData, d.id, d.data())
									this.$set(cfData[path].queryOldData, d.id, JSON.parse(JSON.stringify(d.data())))
								})
							}
						} else cfData[path].downloadSkips--
					}),
				})
				
				// Create watcher for document updates
				this.$set(cfData[path], 'watcher', this.$watch(
					function () { return cfData[path].data },
					function (val) {
						if (!cfData[path].skipUpdate) {
							cfData[path].downloadSkips++
							updateData(cfData[path].oldData, cfData[path].data, cfData[path].ref, options)
						} else cfData[path].skipUpdate = false
						cfData[path].oldData = JSON.parse(JSON.stringify(cfData[path].data))
					},
					{ deep: true }
				))
			}	

			// Return the firebase data associated with the passed reference
			if (cfData[path].type === 'document') {
				if (options && options.provideID) {
					return { id: cfData[path].doc.id, data: cfData[path].data }
				} else return cfData[path].data
			} else {
				if (options && options.provideID) {
					return cfData[path].queryDocs.map(d => {
						return { id: d.id, data: cfData[path].queryData[d.id] }
					})
				} else {
					return cfData[path].queryDocs.map(d => cfData[path].queryData[d.id])
				}
			}
		}

		// Call this to reset the watchers for a given path
		// Helpful in rare cases where original listeners get garbage-collected inadvertantly
		Vue.prototype.$crossfireReset = function (reference, options) {
			if (!reference) return
			const path = getPath(reference)
			if (!cfData[path]) return
			
			// Reset watcher for document updates
			if (cfData[path].watcher) cfData[path].watcher()
			this.$set(cfData[path], 'watcher', this.$watch(
				function () { return cfData[path].data },
				function (val) {
					if (!cfData[path].skipUpdate) {
						cfData[path].downloadSkips++
						updateData(cfData[path].oldData, cfData[path].data, cfData[path].ref, options)
					} else cfData[path].skipUpdate = false
					cfData[path].oldData = JSON.parse(JSON.stringify(cfData[path].data))
				},
				{ deep: true }
			))

			// Reset watchers for query updates
			cfData[path].queryDocs.forEach(d => {
				if (cfData[path].queryDocWatchers[d.id]) cfData[path].queryDocWatchers[d.id]()
				this.$set(cfData[path].queryDocWatchers, d.id, this.$watch(
					function () { return cfData[path].queryData[d.id] },
					function (val) {
						if (!cfData[path].queryDocSkipUpdate[d.id]) {
							cfData[path].downloadSkips++
							updateData(cfData[path].queryOldData[d.id], cfData[path].queryData[d.id], d.ref, options)
						} else cfData[path].queryDocSkipUpdate[d.id] = false
						cfData[path].queryOldData[d.id] = JSON.parse(JSON.stringify(cfData[path].queryData[d.id]))
					},
					{ deep: true }
				))
			})
		}
	},
}