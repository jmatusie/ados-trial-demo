// @ts-check
const isVerbose = true

const { filename, dirname, url } = import.meta
const path = dirname ?? url.slice?.(0, url.lastIndexOf("/")+1) ?? 'unknown'
const moduleName =  url ? url.slice(url.lastIndexOf("/")+1) 
	: filename && /\//.test(filename) ? filename.split("/")?.at(-1) 
	: filename && /\\/.test(filename) ? filename.split("\\")?.at(-1) 
	: 'unknown'
const logHeader = `${moduleName}`
isVerbose && console.log(`[${logHeader}]: Starting, path ${path}...`)

import { FileSaver } from './ClassFileSaver.mjs'
//import { normalizedDataTable } from './Parser_Result_Helpers.mjs'


/** class CSV
	* 
	* Usage:
	* 	with constructor/new:  
	* 		const csvText = `col1: col2: col3: col4
	*										"a": "b123": "c123"
	*											"b": "d123": 14253324532345
	*											"c": "d123": "e123": 54311`
	*
	*		const csvObj = 		new CSV(csvText, ':')					// use colon as delimiter (default is comma)
	*		const dataSet1 = 	csvObj.toDataSet()							// outut to dsArray with the first row as columns (default)
	*		const dataSet2 =	csvObj.toDataSet('one', 'two', 'three', 'four')		// outut to dsArray with the column names as supplied
	* 
	* 	// use as stateless (factory) class: 
	* 		const dataSet3 = CSV.toDataSet(csvText)		// defaults to comma as delimiter, and first-record as column names
	* 		const dataSet4 = CSV.toDataSet(csvText, { delimiter:':', colNames:['one','two','three','four'] })  // optional user-supplied delimiter & colnames
	*
	* 	// output to table (object with header & dataTable pre-separated for easier HTML rendering, etc)
	*		const table1 = csvObj.toTable('one', 'two', 'three', 'four')		// outut to dsArray with the column names as supplied
	* 		const table2 = CSV.toTable(csvText)
	* 		const table3 = CSV.toDataSet(csvText, { delimiter:':', colNames:['one','two','three','four'] })  // optional user-supplied delimiter & colnames
	* 
	* 	// output to series (object whose entries are arrays containing columns)
	*		const series1 = csvObj.toSeries('one', 'two', 'three', 'four')		// outut to dsArray with the column names as supplied
	* 		const series2 = CSV.toSeries(csvText)
	* 		const series3 = CSV.toSeries(csvText, { delimiter:':', colNames:['one','two','three','four'] })  // optional user-supplied delimiter & colnames
	* 
	* // like JSON.parse, CSV.parse allows an optional user-provided function to operate on parsed data (raw records are arrays of arrays)
	* 		const raw1 = csvObj.parse()							// outputs raw data
	* 		const raw2 = csvObj.parse( dsArr=>dsArr.map(lineArr=>lineArr.join(':')) )	// runs user-supplied function on raw data (this re-stringifies each line)
	* 		const raw2 = CSV.parse(csvText)
	* 		const raw3 = CSV.parse(csvText, { delimiter:':', parseFn: dsArray=>dsArray.map(lineArray=>lineArray.join(',') ) })  // optional user-supplied delimiter & colnames
	* 
	* // like JSON.stringify, this takes a dsArray and creates a new CSV from it
	* 		const csvString1 = csvObj.stringify()
	* 		const csvString2 = csvObj.stringify({delimiter:':', stringifyFn: dsArray=>dsArray.map(record=>record.map(cell=>`"${cell}"`).join(','))}})
	* 		const csvString3 = CSV.stringify(dsArray)
	* 		const csvString4 = CSV.stringify(dsArray)
	*/




/** 
 * Borrowed from PatternMatching.mjs.  Do not modify here...
 */
const is = {
	array: /** @returns { item is Array 		} */		(item) => Array.isArray(item),
}

const arr = {
	isEmpty 			: /** @type {PF_Pred} 			*/ 						 		(arr1) =>	Array.isArray(arr1) && arr1.length === 0,
}
	

/** copied from Parser_Result_Helpers.mjs, which istelf is not a good home for these functions.  
 * These functions should find a new home, but are here because we need it for class CSV to 
 * remove the dependency on Parser_Result_Helpers, which was very wrong to depend on for this class...
 */


/**** Schema Normalization  ****/

// discovers every first-level property name in an array of objects returns a the union of all property names
// discoverSchema :: [object] -> [string]
const discoverSchema = (objArray=[]) => {
	const allKeys = objArray.map((item) => Object.keys(item)).flat()
	/* dedup any records with identical schema */
	const returnVal = [...new Set(allKeys)]
	return returnVal
}

// creates a blank object with all properties in the supplied list of names
// createObjectTemplateFrom :: [string] => dsItem
const createObjectTemplateFrom = (...propList) => Object.fromEntries(propList.flat().map((dsItem) => [dsItem, '']))


// adds new prop names (blank values) to an existing object for the purposes of data normalization
// applyTemplateObj :: dsItem => dsItem => dsItem 
const applyTemplateObject = (template) => (dsItem) => ({ ...template, ...dsItem })


// applySchema :: [string] => dsArray
const applySchema = (...columnNames) => (objectArray) => objectArray.map((dataItem) => ({ ...createObjectTemplateFrom(columnNames.flat()), ...dataItem }))


// 	previously called "normalizedDataSet" & "setSchemaAuto"
//	setSchemaAuto :: [Object] => dsArray
const applySchemaAuto = (objectArray) => {
	const templateObject = createObjectTemplateFrom(discoverSchema(objectArray))
	return objectArray.map((item) => ({ ...templateObject, ...item, }))
}

const normalizedDataSet = applySchemaAuto

//	setSchemaAuto :: [Object] => dataTableObject
const normalizedDataTable = (objectArray) => {
	const header = discoverSchema(objectArray)
	const template = createObjectTemplateFrom(header)
	const normalizedData = objectArray.map(applyTemplateObject(template))
	
	const rows = normalizedData.map((dsItem) => Object.values(dsItem))
	return {
		header,
		rows
	}
}

//	setSchemaAuto :: [Object] => dataTableObject
const normalizedDataTable_old = (objectArray) => {
	const header = discoverSchema(objectArray)
	const template = createObjectTemplateFrom(header)
	const normalizedData = objectArray.map(applyTemplateObject(template))
	// const rows = objectArray.map(normalizedData).map((dsItem) => Object.values(dsItem))
	const rows = objectArray.map((dsItem) => Object.values(dsItem))
	return {
		header,
		rows
	}
}

// takes an array of similar objects, finds all common keys, returns a structure containing two properties:
//		1) header: an array of all the discovered collective key names in the dataset
//		2) dataSet: a normalized dataSet where all items have the same common keys, filling all missing
// 				keys with a ''
// tableFromDataSet :: dsArray -> DataTable
const tableFromDataSet = (dsArray) => {
	const headerArray = discoverSchema(dsArray)
	const templateObj = createObjectTemplateFrom(headerArray)
	const normalized = dsArray.map((dsItem) => Object.assign({ ...templateObj }, dsItem))
	const table = {
		header: headerArray,
		rows: normalized.map((dsItem) => Object.values(dsItem))
	}
	return table
}


// promoteTableHeader :: DataTable -> DataTable
const promoteTableHeader = (dataTable) => {
	return (dataTable.header && dataTable.rows && dataTable.rows.length > 0) ?
		{
			header: dataTable.rows[0],
			rows: dataTable.rows.slice(1)
		}
		: dataTable
}



/** Output Mapping helpers  **********************
*		used as helpers inside of .map() methods to transport/reshape the output of results
*/
/** wrapInStrings:   parser output mapping helper
*		@param lstr: string to prepend to a result
*		@param rstr: string to append  to a result
*		@param parserResult: any result from a parser (can be a string, array, or null)
*		@return: if parseResult is not an array, returns a string value of the parseResult (wrapped empty string if parseResult is null).
						 if parseResult is an array, returns a array of wrapped values
*/
const wrapInStrings = (lstr, rstr) => (parserResult) => {
	if (is.array(parserResult)) return parserResult.map((x) => `${lstr}${x ? x : ''}${rstr}`)
	else return `${lstr}${parserResult ? parserResult : ''}${rstr}`
}





// NOTE: Javascript sets unsupplied rest params to '[]', not 'undefined'
class CSV {

	// constructor free of 'new' keyword
	static of(rawTxt = '', delimiter = ',') {
		return new CSV(rawTxt, delimiter)
	}

	// curried constructor - for use inside .map() functions 
	static new = (delimiter = ',') => (rawTxt = '') => new CSV(rawTxt, delimiter)


	constructor(rawTxt = '', delimiter = ',') {
		this.delimiter = delimiter
		//this.rawRecords = rawTxt.split(/[\n\r]+/g).map((line) => line.split(delimiter).map((tok) => tok.trim().replace(/"/g, '')))
		this.rawRecords = rawTxt.split(/[\n\r]+/g).map((row) => CSV.deserializeRow(row, delimiter))
	}


	getRecords() {
		return [...this.rawRecords]
	}

	// run parser function on raw data for alternative output	(like JSON.parse does)
	parse(parseFn = (dsArray) => dsArray) {
		return parseFn([...this.rawRecords])
	}

	// convert CSV to array of isomorphic flat objects (dsArray)
	// _colNames is optional - if not supplied, the first row of data is assumed to contain column names
	toDataSet(..._colNames) {
		const useFirsRowAsHeader = arr.isEmpty(_colNames.flat()) ? true : false
		const colNames = useFirsRowAsHeader ? this.rawRecords[0].slice() : _colNames.flat()
		const records = useFirsRowAsHeader ? this.rawRecords.slice(1) : this.rawRecords.slice()
		const dataSet = records.map((record) => Object.fromEntries(colNames.map(
			(colName, colNum) => [colName, record[colNum] ?? ``]
		)))
		return dataSet
	}

	// new version - will-shape table based on how many columns are supplied in the colNames
	toTable(..._colNames) {
		const useFirsRowAsHeader = arr.isEmpty(_colNames.flat()) ? true : false
		const colNames = useFirsRowAsHeader ? this.rawRecords[0].slice() : _colNames.flat()
		const records = useFirsRowAsHeader ? this.rawRecords.slice(1) : this.rawRecords.slice()

		// reshaping to accommodate different geometries 
		const numCols = colNames.flat().length		// calculate #of rows in new geometry
		const flattenedRecords = records.flat() 	// normalize geometry to single a 1D array - one entry per data element in the entire dataset
		// @MIA - check if it seems right that we're using flattenedRecords.length in a while loop
		let newTable = []
		while (flattenedRecords.length !== 0) newTable.push(flattenedRecords.splice(0, numCols))

		// old method
		//	for (let z=0; z<inputRowCount; z=z+numCols) {
		//		newTable.push(flattenedRecords.slice(z,z+numCols).flat())
		//	}

		return {
			header: colNames,
			rows: newTable,
		}
	}


	toTable_orig(..._colNames) {
		const useFirsRowAsHeader = arr.isEmpty(_colNames.flat()) ? true : false
		const colNames = useFirsRowAsHeader ? this.rawRecords[0].slice() : _colNames.flat()
		const records = useFirsRowAsHeader ? this.rawRecords.slice(1) : this.rawRecords.slice()
		const table = {
			header: colNames,
			rows: records,
		}
		return table
	}

	toSeries(..._colNames) {
		const useFirsRowAsHeader = arr.isEmpty(_colNames.flat()) ? true : false
		const colNames = useFirsRowAsHeader ? this.rawRecords[0].slice() : _colNames.flat()
		const records = useFirsRowAsHeader ? this.rawRecords.slice(1) : this.rawRecords.slice()
		const series = colNames.reduce((acc, colName, colNum) => {
			acc[colName] = records.map((lineItem) => lineItem[colNum])
			return acc
		}, {})
		return series
	}

	stringify(fn_stringifyCell=(cell)=>`"${cell}"`, delimiter=',') {
		return this.getRecords().map((row) => row.map(fn_stringifyCell).join(delimiter)).join('\n')
	}

	stringify_old(fn_stringifyCell=null) {
		return (fn_stringifyCell === null)
			? this.getRecords().map((record) => record.map((cell) => `"${cell}"`).join(',')).join('\n')
			: fn_stringifyCell(this.getRecords())
	}

	stringifyQuoted(stringifyFn = null, ) {
		return (stringifyFn === null) ?
			this.getRecords().map((record) => record.map((cell) => `"${cell}"`).join(',')).join('\n')
			: stringifyFn(this.getRecords())
	}

	saveAs(_fileName = 'untitled') {
		const fileName = (_fileName.endsWith('.csv')) ? _fileName : `${_fileName}.csv`
		const csv = this.stringify()
		FileSaver.saveAs(csv, fileName)
	}

	import_dataTable(dataTable) {
		const { header, rows } = dataTable
		const columnCount = header.length
		// sanity checking 
		if (!header || !rows) throw new Error(`[CSV::import_dataTable]: supplied data is not a data table`)
		for (const row of rows) {
			if (row.length !== columnCount) throw new Error(`[CSV::import_dataTable]: some rows do not contain the necessary columns (${columnCount} are needed)`)
		}
		const newCSV = new CSV()
		newCSV.rawRecords = [header, ...rows]
		return newCSV
	}


	import_dsArray(dsArray = []) {
		const newCSV = new CSV()
		const tableFrom_dsArray = normalizedDataTable(dsArray)
		newCSV.rawRecords = [tableFrom_dsArray.header, ...tableFrom_dsArray.rows]
		return newCSV
	}

	// supports CSV as factory for stateless use
	static toDataSet(rawTxt = '', { delimiter = ',', colNames = [] } = {}) {
		return new CSV(rawTxt, delimiter).toDataSet(colNames)
	}

	static toTable(rawTxt = '', { delimiter = ',', colNames = [] } = {}) {
		return new CSV(rawTxt, delimiter).toTable(colNames)
	}

	static toSeries(rawTxt = '', { delimiter = ',', colNames = [] } = {}) {
		return new CSV(rawTxt, delimiter).toSeries(colNames)
	}

	static parse(rawTxt = '', { delimiter = ',', parseFn = (dsArray) => dsArray } = {}) {
		const rawRecords = new CSV(rawTxt, delimiter).getRecords()
		return parseFn(rawRecords)
	}

	/** Static methods from 30secondsofcode - may cover more use cases
	 * * @see https://www.30secondsofcode.org/js/s/convert-csv-to-array-object-or-json/ 
	 */

	static isEmptyValue = (value) => value === null || value === undefined || Number.isNaN(value)

	static serializeValue = (value, delimiter=',') => {
		if (CSV.isEmptyValue(value)) return ''
		const valueAsString = `${value}`
		if (valueAsString.includes(delimiter) || valueAsString.includes('\n') || valueAsString.includes('"') ) {
			return `"${valueAsString.replace(/"/g, '""').replace(/\n/g, '\\n')}"`;
		}
		return valueAsString;
	}

	static serializeRow = (row, delimiter=',') => row.map(value => CSV.serializeValue(`value`, delimiter)).join(delimiter);

	static arrayToCSV = (arr, delimiter=',') => arr.map( (row) => CSV.serializeRow(row, delimiter)).join('\n')

	static extractHeaders = (arr) => [...arr.reduce((accSet, obj) => {
		Object.keys(obj).forEach((key) => accSet.add(key))
		return accSet
		}, 
		new Set()
	)]

	static objectToCSV = (arr, headers=CSV.extractHeaders(arr), omitHeaders = false, delimiter = ',') => {
		const headerRow = CSV.serializeRow(headers, delimiter);
		const bodyRows = arr.map(obj =>
			CSV.serializeRow(
				headers.map(key => obj[key]),
				delimiter
			)
		);
		return omitHeaders
			? bodyRows.join('\n')
			: [headerRow, ...bodyRows].join('\n');
	}

	static JSONToCSV = (json, headers, omitHeaders) => CSV.objectToCSV(JSON.parse(json), headers, omitHeaders)
	
	static deserializeRow = (row, delimiter = ',') => {
		const values = []
		let index = 0, matchStart = 0, isInsideQuotations = false;
		while (true) {
			if (index === row.length) {
				values.push(row.slice(matchStart, index));
				break
			}
			const char = row[index];
			if (char === delimiter && !isInsideQuotations) {
				values.push( row .slice(matchStart, index) .replace(/^"|"$/g, '') .replace(/""/g, `"`) .replace(/\\n/g, `\n`))
				matchStart = index + 1;
			}
			if (char === `"`) {
				if (row[index + 1] === `"`) { 
					index += 1 
				}
				else {
					isInsideQuotations = !isInsideQuotations
				}
			}
			index += 1
		}
		return values
	}

	static deserializeCSV = (data, delimiter = ',') => data.split('\n').map(row => CSV.deserializeRow(row, delimiter))

	static CSVToArray = (data, delimiter = ',', omitHeader = false) => {
		const rows = data.split('\n')
		if (omitHeader) {
			rows.shift()
		}
		return rows.map((row) => CSV.deserializeRow(row, delimiter));
	}


	

}	// end of Class CSV

/** dataSet_fromCSV - curried \
 * 
 */
const dataSet_fromCSV = ({ delimiter = ',', colNames = [] } = {}) => (rawCSV) => CSV.new(delimiter)(rawCSV).toDataSet(colNames)


export {
	CSV,
	dataSet_fromCSV,
}