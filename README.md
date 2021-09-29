# vue-crossfire

![npm](https://img.shields.io/npm/v/vue-crossfire)
![npm bundle size](https://img.shields.io/bundlephobia/min/vue-crossfire)

Simple two-way Firestore syncing in Vue

## Install

```
$ npm install vue-crossfire
```

## Example Usage

```vue
<template>
  <div v-if="liveDoc">
    <h2>{{ liveDoc.title }}</h2>
    <input v-model="liveDoc.text" label="Text">
    <input type="checkbox" v-model="liveDoc.active" label="Active">
  </div>
</template>

<script>
  const cf = require('crossfire')

  // Import crossfire into your mixins, pass a firestore reference into this.crossfire(),
  // then simply read/write to the result as any regular object variable
  export default {
    name: 'VueComponent',
    mixins: [cf],
    computed: {
      liveDoc: function () {
        return this.crossfire(db.collection('someCollection').doc('docID'))
      },
    },
  }
</script>
```

![Demo](https://media.giphy.com/media/FNrwm3rQaT90rw55I4/giphy.gif)
