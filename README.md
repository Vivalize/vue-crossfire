# vue-crossfire

![npm](https://img.shields.io/npm/v/vue-crossfire)
![npm bundle size](https://img.shields.io/bundlephobia/min/vue-crossfire)

Dead simple two-way Firestore syncing in Vue

## Install

```
$ npm install vue-crossfire
```

## Usage

```js
<template>
	<div v-if="liveDoc">
		<h2>{{ liveDoc.title }}</h2>
		<input v-model="liveDoc.text" label="Text">
		<input type="checkbox" v-model="liveDoc.active" label="Active">
	</div>
</template>

// Import crossfire and add into your component mixins
const cf = require('crossfire')

export default {
	name: 'VueComponent',
	mixins: [cf],
	computed: {
		liveDoc: function () {
			return this.crossfire(db.collection('someCollection').doc('docID'))
		},
	},
}
```
