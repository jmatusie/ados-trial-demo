// @ts-check
import { diff } from "./DataSet_Dedup_and_Sets.mjs"
import { mergeDeep } from "./DeepValues.mjs"

import { is, zip } from "./Parser_Result_Helpers.mjs"

/**
 * 
 * @param {object} obj 
 * @param {string} prefix 
 * @returns object
 */
function flattenObject(obj, prefix = '', res={} ) {
	for (const key in obj) {
			const newKey = prefix ? `${prefix}.${key}` : key;
			if (obj?.[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
					flattenObject(obj[key], newKey, res);
			} 
			else if (Array.isArray(obj[key])) {
				res[newKey] = obj[key].map( (item)=>flattenObject(item) )
			}
			else {
					res[newKey] = obj[key];
			}
	}
	return res;
}

const testobj = {
  name: "Mia",
  id: "1",
  parent: {
    name: "Frank",
    id: "1001"
  },
  siblings: [
    {
      name: "Jager",
      id: "2",
      parent: {
        name: "Frank",
        id: "1001"
      }
    },
    {
      name: "Clippy",
      id: "3",
      parent: {
        name: "Frank",
        id: "1001"
      }
    },
    {
      name: "Orion",
      id: "4",
      parent: {
        name: "Frank",
        id: "1001"
      }
    }
  ]
}

const varNames = [
  "name",
  "id",
  "parent.name",
  "parent.id",
  "siblings[0]"
]

const results = varNames.map( (varName) => objectLookup(configObj, varName) )

/** objectLookup(obj)
 * Resolves expressions in template files against an object or array (starting with object). 
 * Should handle the following forms of template expressions:
 *   {{key_as_value}}				// `${ obj.key_as_value }` 
 *   {{sub_obj.key}}				// `${ obj.sub_obj.key }`
 *   {{sub_obj.obj2.key}}		// `${ obj.sub_obj.obj2.key }`
 *   {{key_as_array}}				// `${ obj. }`
 *   {{sub_obj.key[0]}}			// `${ obj.sub_obj.key[0] }`
 *   {{sub_obj[key]}}				
 * 
 * ***** EXAMPLE ******   (from https://pyneng.readthedocs.io/en/latest/book/20_jinja2/syntax_for.html )
 * Supplied Data:
 * 
 *   const obj = {
 *     id: "3",
 *     name: "R3",
 *     vlans: {
 *       10: "Marketing",
 *       20: "Voice",
 *       30: "Management",
 *     },
 *     ospf: [
 *       {
 *         network: "10.0.1.0 0.0.0.255",
 *         area: "0",
 *       },
 *       {
 *         network: "10.0.2.0 0.0.0.255",
 *         area: "2",
 *       },
 *       {
 *         network: "10.1.1.0 0.0.0.255",
 *         area: "0",
 *       }
 *     ]
 *   }
 * 
 * 
 * Jinja2-style template (using Python):
 *   `
 *   hostname {{ name }}
 *   
 *   interface Loopback0
 *    ip address 10.0.0.{{ id }} 255.255.255.255
 *   
 *   {% for vlan, name in vlans.items() %}          <-- vlans.items() is used in this 'for' because 'vlans' is an object, not an array
 *   vlan {{ vlan }}
 *    name {{ name }}
 *   {% endfor %}
 *   
 *   router ospf 1
 *     router-id 10.0.0.{{ id }}
 *     auto-cost reference-bandwidth 10000
 *     {% for networks in ospf %}                  <-- ospf.items() not used, but ospf directly, beacuse ospf is already an array
 *       network {{ networks.network }} area {{ networks.area }} 
 *     {% endfor %}
 * 
 *   `
 *
 * 
 * Alternate Template Syntax #1: Triple-bracket {{{ ... }}} means repeat a supplied template.
 *   An array or object can be used, The repetition can be through an object, when the key name itself is needed in the rendering where $key is a stand-in for the key name
 *   `
 *   hostname {{ name }}
 *   
 *   interface Loopback0
 *    ip address 10.0.0.{{ id }} 255.255.255.255
 *   
 *   {{{ vlans, 											<-- vlans is an object, but treat it like a list  
 *     vlan {{ $key }}								<-- each key of 'vlans' is a value, so $key resolves to the key
 *       name {{name}}
 *   }}}
 * 
 *   router ospf 1
 *     router-id 10.0.0.{{ id }}
 *     auto-cost reference-bandwidth 10000
 *     {{{ ospf, 
 *       network {{network}} area {{area}}
 *     }}}
 * 
 * 
 * 
 * Alternate Template Syntax #2:  use for expression that names the key
 *   `
 *   hostname {{ name }}
 *   
 *   interface Loopback0
 *    ip address 10.0.0.{{ id }} 255.255.255.255
 *   
 *   {{{ for vlanName in vlans, 			<-- instead of using $1, have a 'for' expression that names the key
 *     vlan {{ vlanName }}
 *       name {{name}}
 *   }}}
 * 
 *   router ospf 1
 *     router-id 10.0.0.{{ id }}
 *     auto-cost reference-bandwidth 10000
 *     {{{ ospf, ospftemplate }}} 		<-- since ospf is an array
 *
 * 
 * 
 * Alternate Template Syntax #3: Use JS Syntax & run eval
 *   `
 *   hostname {{ name }}
 *   
 *   interface Loopback0
 *    ip address 10.0.0.{{ id }} 255.255.255.255
 *   
 *   {{{ vlans, 											<-- vlans is an object, but treat it like a list  
 *     vlan {{ $key }}								<-- each key of 'vlans' is a value, so $key resolves to the key
 *       name {{name}}
 *   }}}
 * 
 *   router ospf 1
 *     router-id 10.0.0.{{ id }}
 *     auto-cost reference-bandwidth 10000
 *     {{{ ospf, 
 *       network {{network}} area {{area}}
 *     }}}
 * 
 * 
 * 
 * Alternate Template Syntax #4:  imported templates:
 *   { importTemplate vlanTemplate }
 *   { importTemplate ospfTemplate }
 *   hostname {{ name }}
 *   
 *   interface Loopback0
 *    ip address 10.0.0.{{ id }} 255.255.255.255
 *   
 *   {{{ vlans, vlantemplate }}}       <-- vlantemplate is an imported template.  vlans is an object
 * 
 *   router ospf 1
 *     router-id 10.0.0.{{ id }}
 *     auto-cost reference-bandwidth 10000
 *     {{{ ospf, ospftemplate }}}      <-- ospftemplate is imported.  ospf is an Array
 *
 * 
 * 
 * 
 * 
 * 
 * 
 * 
 * @param {object} obj - the data
 * @param {string} exp - Template expression
 */ 
function objectLookup(obj, exp) {

}


// depends on: pattermatching API,

/**
 * @typedef {Template|string} Doc
 */

class Template {
	/** @param {Template | string} doc */
	static of(doc) {
		return new Template(doc)
	}

	/** @param {Array<Template> } _templates */
	static seqOf(..._templates) {
		const templates = _templates.flat()
		return templates.reduce((accTemplate, templateItem) => accTemplate.append(templateItem), new Template(''))
	}

	/** 
	 * @param { Template } template
	 * @param { string } listName
	 */
	static many(template, listName) {
		const renamedVars = template.varNames.map( (varName) => `${listName}.${varName}` )
		const t = new Template(template)
		t.varNames = renamedVars
		return t.render()
	}

	/** @param {Template | string} doc */
	constructor(doc) {
		/** @type { Array<string> } */
		this.strings = []
		/** @type { Array<string> } */		
		this.varNames = []
		/** @type { Doc } */		
		this.originalDocument = doc // internal use for sanitycheck

		const { strings, varNames } = (doc instanceof (Template)) ? (doc.valueOf()) : (Template.#parse(doc))
		this.strings = strings
		this.varNames = varNames
	}

	// mainly used for internal use (in constructor), but can be used as a standalone function thus static...
	/** @param {string} templateStr */
	static #parse_v2(templateStr) {
		const regexToSeparateVars = new RegExp(/{{(\S*)}}/g) 				// RegExp for extracting Jinja-like variable names i.e. {{var}}
		/** @type { Array<string> } */
		const strings = []
		/** @type { Array<string> } */		
		const varNames = []		
		const parts = templateStr.split(regexToSeparateVars)

		let c = 0
		while (parts[c] != null) {
			strings.push(parts[c++])
			if (parts[c]) { 
				varNames.push(parts[c++]) 
			}
		}
		return { strings, varNames }
	}

	// mainly used for internal use (in constructor), but can be used as a standalone function thus static...
	static #parse(doc='') {
		const regexToSeparateVars = new RegExp(/{{(\S*)}}/g) 				// RegExp for extracting Jinja-like variable names i.e. {{var}}
		const [strings, varNames] = doc.split(regexToSeparateVars).reduce(
			(accArr, item, idx) => (accArr[idx % 2].push(item), accArr),									// group array into odds & evens (strings have evens, vars have odds)
			[[], []]
		)  // split doc into strings & variables
		return { strings, varNames }
	}

	// return internal data structure, excluding any private class values.  This should really be a flat() function in monadic lingo...
	valueOf = () => ({
		strings: [...this.strings],
		varNames: [...this.varNames],
	})

	// render, but return raw data (used for other render functions)
	execute(configObj = {}) {
		const flattenedObject = flattenObject(configObj)
		const unusedParts = diff(Object.keys(flattenedObject), this.varNames)	// this will determine if the template is fully resolved against the variables supplied
		const resolvedVars = this.varNames.map((varName) => flattenedObject?.[varName] ?? `{{${varName}}}`)
		const renderedDoc = zip(this.strings)(resolvedVars).join('')
		return {
			renderedDoc,
			resolvedVars,
			unusedParts,
			originalDocument: this.originalDocument
		}
	}

	/** @param { Doc } documentOrTemplate */
	append(documentOrTemplate) {
		// two parts will automatically resolve to string inside the literals
		return new Template(`${this}${documentOrTemplate}`)
	}

	// render & return new Template
	render(configObj = {}) {
		const rawResults = this.execute(configObj)
		return new Template(rawResults.renderedDoc)
	}

	// render a list of values, rendering the list as an array of Templates, and returing a single new 
	//	Template made from the resulting (joined) templates
	// renderMany :: thisTemplate -> [dataItems] -> [Template]
	/** @param {Object[]} configObjs */
	renderMany = (configObjs) => {
		const intermediateResult = (is.iterable(configObjs)) ?  //	if arg is actually an array (expected)
			configObjs.map((configObj) => this.toString(configObj))			// 		then render for each value
			: this.toString(configObjs)															//	but if not, render it normally
		return new Template(intermediateResult)
	}

	/** renderIf  ::	thisTemplate ->	(predFn :: configObj -> Boolean) -> configObj => Template
	 * predicateFn :: configObj -> Boolean
	 * (note: this is supposed to be monadic - expiriment a bit)
 	 * @type { <T extends object>(predFn:(configObj:T)=>boolean) => (configObj:T) => Template } 
	 */
	renderIf = (predFn) => (configObj) => predFn(configObj) ? this.render(configObj) : this.render()

	/** render_monadic1()  ::	thisTemplate ->	(configObj -> Template) -> configObj => Template
	 * patternMatchingFn:: 	configObj -> Template
	 * 
	 * render_monadic1 allows a user to use switch(configObj) and/or if/then statements
	 * to decide what and how to render with a user-supplied function.   The function
	 * can accepts the configObj, and thorugh branched conditional logic, must return a Template object
	 * of one type or another
	 **/
	render_monadic1 = (typeLiftingPatternMatchingFn) => (configObj) => {
		return new Template(typeLiftingPatternMatchingFn(configObj))
	}

	/** render_monadic2()  ::	thisTemplate ->	(patternMatchingFn :: configObj -> Template) -> configObj => Template
	 * patternMatchingFn:: 	configObj -> Template
	 * 
	 * render_monadic2 is more powerful (and more dangerous), allowing a user to supply a function
	 * that no only can read the configObj, but also has access to the Template state
	 * The function accepts templateState, and then a configObj, and must return a Template object
	 **/
	render_monadic2 = (typeLiftingPatternMatchingFn) => (configObj) => {
		return new Template(typeLiftingPatternMatchingFn(configObj))
	}


	/** report()   :: thisTemplate -> Object
	 * Produces a template object describing the data format that this template needs
	 * If this.vars looks like this: 
	 * 		"item1.var1.subvar1", 
	 * 		"item1.var2", 
	 * 		"item2.var1.subvar1.sub1", 
	 * 		"item2.var1.subvar1.sub2", 
	 * 		"item2.var1.subvar1.sub3", 
	 * 		"item2.var1.sub2"
	 * 		"item3",
	 * 	Then expectecd output looks like this:
	 * {
	 * 	item1: {
	 * 		var1: {
	 * 			subvar1: '',
	 * 		}
	 * 		var2: '',
	 * 	},
	 * 	item2: {
	 * 		var1: {
	 * 			subvar1: {
	 * 				sub1: '',
	 * 				sub2: '',
	 * 				sub3: '',
	 * 			},
	 * 			sub2: ''	f
	 * 		}
	 * 	}
	 * 	item3: '',
	 * }	
	 **/
	report() {
		const varNames = [...this.varNames]
		// g :: [objKey] ->	
		const dottedSequenceStringToObject = (keyList) => {
			const [nextKey, ...remainder] = keyList		// immutably, take the first item in the array
			return {
				[nextKey]: remainder.length > 0 ? 		// as long as we're not done with what was our dotted list,
					dottedSequenceStringToObject(remainder) 	// recurse into array to keep building additional levels of nesting
					: ''
			}																			// if at the end, our key is terminal, so we assign it to ''
		}
		return [...varNames]
			.map((varStrEntry) => varStrEntry.split('.'))
			.reduce((acc, item) => mergeDeep(acc, dottedSequenceStringToObject(item)), {})
	}

	// check the original document against parsed & re-assembled results (pre-rendering)
	// 	use in a chain like mytemplate.sanityCheck().render(configObj) - it will silently continue if passed or throw exception otherwise
	sanityCheck() {
		const failedSanityCheck = (this.execute().renderedDoc !== this.originalDocument.toString())
		if (failedSanityCheck) {
			throw new Error('Template.sanityCheck() failed', { 
				cause: {
					state: this.execute(),
					originalDocument: this.originalDocument.toString()
				}
			})
		}
		return this
	}

	// print current state of document
	toString(configObj = {}) {
		return this.execute(configObj).renderedDoc
	}

	/** @param {string} listName */
	tagAs(listName) {
		const renamedVars = [...this.varNames].map((varName) => `${listName}.${varName}`)
		const t = new Template(this)
		t.varNames = renamedVars
		return t.render()
	}


	/** @param {string} listName */
	many(listName) {
		return Template.many(this, listName)
	}

}	// end of class Template


export {
	Template,
}
