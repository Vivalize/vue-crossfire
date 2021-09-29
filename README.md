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
// Import crossfire and add into your component mixins
const cf = require('crossfire')

export default {
	name: 'VueComponent',
	mixins: [cf],
	data () {
		return {
			firebaseRef: db.collection('todos').doc('1337')
		}
	},
}
```
