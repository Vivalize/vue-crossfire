# vue-crossfire

![npm](https://img.shields.io/npm/v/vue-crossfire)
![npm bundle size](https://img.shields.io/bundlephobia/min/vue-crossfire)

Dead simple two-way Firestore syncing in Vue

Works with projects built with Firebase V9 and Vue 2

## Install

```
$ npm install vue-crossfire
```

## Usage

```js
import Crossfire from 'vue-crossfire'

const firestoreDoc = new Crossfire(firestoreReference[, options ])
```

## Constructors
#### Crossfire( firestoreReference[, options ] )

This returns a live snapshot of the provided Firestore reference, structured identially to a snapshot you would receive from a normal Firestore ```onSnapshot()``` method. Single document data is still accessed with .data(), and query/collection doc data is still accessed at .docs[x].data().

Every instance of document data is binded two way. Mutating the document data will instantly update it in Firestore as well. (Before the initial snapshot of the reference is received, .data() and .docs will be undefined. You can access .loading to see if the initial state has been received yet). Any remote changes to the data in Firestore will instantly update the local object as well.

Once you're done with the documents, call ```.destroy()``` on the instance to stop listening to the document/collection

```js
import crossfire from 'vue-crossfire'

const documentSync = crossfire(doc(db, 'docCollection', 'docID'))
const collectionSync = crossfire(collection(db, 'colletionName'), { readOnly: true })
const querySync = crossfire(query(collection(db, 'colletionName'), where('fieldID', '==', true)))
```

**firestoreReference** is a reference to a Firestore V9 document, collection, or query
The method will return the data contained at that reference:
  If reference is a document, it will be the document data
  Otherwise, it will be an array of document data of the results
  Before the first state has been downloaded, it will return null

The optional **options** object can be configured with the following fields:
* * *
#### onError: *function (error) - default undefined*
Callback for any errors that occur during document writes

#### readOnly: *Boolean - default: false*
If true, don't update firestore if the local data is changed

#### ignoreUnchangedFields: *Boolean - default: false*
When updating firestore docs, only update the specific fields that were changed in the data. This is slightly more computationally expensive, but is very useful when many users are editing a document at the same time and may overwrite data with their local state before they've received new changes

#### transformUpdate: *function (changedData) - default undefined*
Whenever a document is to be updated in firestore, the data to be saved will instead use the result of this function (if it's provided). Useful if you want to attach update metadata to the document (such as "dateModified" or "lastModifiedBy")
    

## Example

```vue
<template>
  <div>
    <h1>Single Document Syncing</h1>
    <div v-if="docSync.data()">
      <h2>{{ docSync.data().title }}</h2>
      <input v-model="docSync.data().text" label="Text">
      <input type="checkbox" v-model="docSync.data().active" label="Active">
    </div>
    
    <h1>Collection/Query Syncing</h1>
    <div v-if="querySync.docs">
      <div v-for="doc in querySync.docs" :key="doc.id">
        <h2>{{ doc.data().title }}</h2>
        <input v-model="doc.data().text" label="Text">
        <input type="checkbox" v-model="doc.data().active" label="Active">
      </div>
    </div>
  </div>
</template>

<script>
  import { doc } from 'firebase/firestore'

  // Pass a firestore reference into crossfire(),
  // then simply read/write to the resulting snapshot as any regular object variable
  export default {
    name: 'VueComponent',
    data: function () {
      return {
        docSync: null,
        querySync: null,
      }
    }
    created: function () {
      this.docSync = crossfire(doc(db, 'someCollection', 'docID'))
      this.querySync = crossfire(query(collection(db, 'someCollection'), where('author', '==', 'uuid')))
    },
    destroyed: function () {
      this.docSync.destroy()
      this.querySync.destroy()
    },
  }
</script>
```

![Demo](https://media.giphy.com/media/FNrwm3rQaT90rw55I4/giphy.gif)
    