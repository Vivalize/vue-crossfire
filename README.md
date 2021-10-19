# vue-crossfire

![npm](https://img.shields.io/npm/v/vue-crossfire)
![npm bundle size](https://img.shields.io/bundlephobia/min/vue-crossfire)

Dead simple two-way Firestore syncing in Vue

Works with projects built with Firebase V9 and Vue 2

## Install

```
$ npm install vue-crossfire
```

Then when initializing your Vue app:
```vue
import Crossfire from 'vue-crossfire'
Vue.use(Crossfire)
```

## Usage

#### $crossfire( firestoreReference[, options ] )

This method returns the data at the respective Firestore reference, binded two-way. It will update reactively with any remote changes, and any local changes will be immedietly updated in Firestore. Returns **null** initially before the first update has been retrieved.

```js
var documentSync = this.$crossfire(doc(db, 'docCollection', 'docID'))
var collectionSync = this.$crossfire(collection(db, 'colletionName'), { readOnly: true })
var querySync = this.$crossfire(query(collection(db, 'colletionName'), where('fieldID', '==', true)))
```

**firestoreReference** is a reference to a Firestore V9 document, collection, or query
The method will return the data contained at that reference:
  If reference is a document, it will be the document data
  Otherwise, it will be an array of document data of the results
  Before the first state has been downloaded, it will return null

The optional **options** object can be configured with the following fields:
* * *
provideID: *Boolean - default: false*

    If set to true, this method will return both the document data as well as the document ID(s)
    in the form: { id: *docID*, data: *docData* } instead of only returning the document data.
    In the case of collections or queries, it will return an array of objects in the above form.

readOnly: *Boolean - default: false*

    If true, don't update firestore if the local data is changed

ignoreUnchangedFields: *Boolean - default: false*

    When updating firestore docs, only update the specific fields that were changed in the data. This is slightly more computationally expensive, but is very useful when many users are editing a document at the same time and may overwrite data with their local state before they've received new changes

transformUpdate: *function (changedData) - default undefined*

    Whenever a document is to be updated in firestore, the data to be saved will instead use the result of this function (if it's provided). Useful if you want to attach update metadata to the document (such as "dateModified" or "lastModifiedBy")
    

## Example

```vue
<template>
  <div v-if="liveDoc">
    <h2>{{ liveDoc.title }}</h2>
    <input v-model="liveDoc.text" label="Text">
    <input type="checkbox" v-model="liveDoc.active" label="Active">
  </div>
</template>

<script>
  import { doc } from 'firebase/firestore'

  // Pass a firestore reference into $crossfire(),
  // then simply read/write to the result as any regular object variable
  export default {
    name: 'VueComponent',
    computed: {
      liveDoc: function () {
        return this.$crossfire(doc(db, 'someCollection', 'docID'))
      },
    },
  }
</script>
```

![Demo](https://media.giphy.com/media/FNrwm3rQaT90rw55I4/giphy.gif)
