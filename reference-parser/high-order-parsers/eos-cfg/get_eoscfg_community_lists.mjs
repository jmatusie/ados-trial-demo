import {
	// from Parser_Result_helpers.mjs
	flattenArray,
	joinWith,
	mapArray,
	multiplyBy,
	addTag,
	flattenItemWith,
	flattenItemRecursively,
	flattenItemRecursivelyWith,
	multiplyBy_v2,
	nullToArray,
	nullToStr,
	normalizedDataSet,
	groupByPropName,

	// from Parser_Core.mjs
	seqOf,
	sequenceOf,
	regex,
	oneOf,
	many,
	possibly,
	lookAhead,
	setOf,
	succeedWith,
	everythingUntil,
	except,
	strng,
	many1,

	// from Parser_Text.mjs
	parseLine,
	digits,
	rol,
	hword,
	at_eol,
	eol,
	tok,
	word,
	nbsp,			// consume one or more spaces and/or tabs
	_,				// 0 or more consequtive inline whitespace (spaces & tabs)
	__,				// 0 or more consequetive whitespace (spaces, tabs, newlines, carriage returns)

	// from Parser_Network.mjs
	ipAddress,
	ipUC,
	ipMC,
	ipNetwork,
	ipNetwork_asObject,
	gotoSection,
	parseSection,
	hostnameFromConfig,
	endOfIndentLevel,
	gotoStr,
	until,
	goto,

	// other
	dedent, // from dedent.mjs

} from '../parser_modules.mjs'

/**************************************************************
 * General/shared sub-line parsers / helpers - 
 */
const _16bit = digits				// 16-bit integer for various community formats (0-65535)
const _32bit = digits				// 32-bit integer for various community formats (0-4294967295)



/**************************************************************
 * Standard Communities - parses a single value
 **************************************************************/

const std_community_value = sequenceOf(
	_16bit.tag('left'),
	':',
	_16bit.tag('right')
).getTaggedR()
	.map(({ left, right }) => ({
		left,
		right,
		value: `${left}:${right}`,
	}))



/**************************************************************
 * Large Communities - parses a single value
 **************************************************************/

const lrg_community_value = sequenceOf(
	_32bit.tag('left'),
	':',
	_32bit.tag('mid'),
	':',
	_32bit.tag('right'),
).getTaggedR()
	.map(({ left, mid, right }) => ({
		left,
		mid,
		right,
		value: `${left}:${mid}:${right}`,
	}))


/**************************************************************
 * Extended Communities - parses a single value
 **************************************************************/

// rfc4360 type 0x00 extended community format: [16bit]:[32bit]
// parses a single entry like: 'rt 65001:1' and/or 'soo 65001:1'
const ext_community_value_as_asn = sequenceOf(
	oneOf('rt', 'soo').tag('extType'),
	nbsp,
	_16bit.tag('left'),
	':',
	_32bit.tag('right')
).getTaggedR()
	.map(({ extType, left, right }) => ({
		left,
		right,
		value: `${extType}-asn/${left}:${right}`,
	}))


// rfc4360 type 0x01 route-target: [32bit(IP)]:[16bit]
// parses a single entry like: 'rt 198.18.101.1:12' and/or 'soo 198.18.101.1:12'
const ext_community_value_as_ipaddr = sequenceOf(
	oneOf('rt', 'soo').tag('extType'),
	nbsp,
	ipAddress.tag('left'),
	':',
	_16bit.tag('right')
).getTaggedR()
	.map(({ extType, left, right }) => ({
		left,
		right,
		value: `${extType}-ip/${left}:${right}`,
	}))


// for rfc4360 type 0x02 route-target (as-dot format): [16bit].[16bit]:[16bit]
// parses an entry like: 'rt 65001.1:101' and/or 'soo 65001.1:101'
const ext_community_value_as_asdot = sequenceOf(
	oneOf('rt', 'soo').tag('extType'),
	nbsp,
	_16bit.tag('left'),
	'.',
	_16bit.tag('mid'),
	':',
	_16bit.tag('right')
).getTaggedR()
	.map(({ extType, left, mid, right }) => ({
		left,
		mid,
		right,
		value: `${extType}-asdot/${left}.${mid}:${right}`,
	}))



// rfc9256 options for altering the BGP community (and override color-only "CO" policy)
const color_only_exactMatch = tok('color-only exact-match').map((res) => `/color-only/exact-match`)
const color_only_null_endpoint = tok('color-only endpoint-match null').map((res) => `/color-only/endpoint-match/null`)
const color_only_any_endpoint = tok('color-only endpoint-match any').map((res) => `/color-only/endpoint-match/any`)
const colorOptions = oneOf(
	color_only_exactMatch,
	color_only_null_endpoint,
	color_only_any_endpoint,
)


// parses color entries
const ext_community_value_color = sequenceOf(
	tok('color'),
	digits.tag('value'),
	possibly(colorOptions).map(nullToStr).tag('colorOptions'),
).getTaggedR()
	.map(({ value, colorOptions, ...rest }) => ({
		value: `color/${value}${colorOptions}`,
		...rest,
	}))


// parses other unhandled entries (lbw, color, etc)
const ext_community_value_other = sequenceOf(
	word.tag('extType'),
	tok(/\S+/).tag('value'),
).getTaggedR()
	.map(({ extType, value }) => ({
		value: `${extType}/${value}`,
	}))


const ext_community_value = oneOf(
	ext_community_value_as_asn,
	ext_community_value_as_ipaddr,
	ext_community_value_color,
	ext_community_value_other,
)


/**************************************************************
 * "main" function of this module
 **************************************************************/

/** @type {(deviceName):string => Parser<eoscfg_community_lists_v2>} */
const get_eoscfg_community_lists = (deviceName) => {
	/** SECTION 1: module metadata ****/
	const pmodule = {
		name: 'get_eoscfg_community_lists',	// used for module identification when using logging in this module (i.e. logResult(`[${pmodule.name}]: blah blah blah`)
		ver: 2,															// future capability
		usage: `const results = get_eoscfg_community_lists(somedeviceName)`,													// future capability to provide help (may not be used)
		desc: dedent`
      Constructs a Parser instance to parses EOS 'ip community-list...'.  Handles types 'standard', 'extended', and 'large'.
      NOTES: After parsing & before returning records, this module drops all community-list names which exist more than once in the configuration.  
      This maybe a capability, but is currently considered a misconfiguration.  The drop will be recorded in this parser's dataLog.
      Sources:
      https://www.arista.com/en/support/toi/eos-4-21-1f/14079-asn-mode-regular-expressions-for-bgp-as-path-attributes
      https://www.arista.com/en/um-eos/eos-border-gateway-protocol-bgp#xx1116839
    `,
		returnSchema: {
			deviceName: "This is the parameter passed into the function by the framework. Used for error reporting as well",
			communityListName: "The name of the community-list,",
			communityListType: "One of: 'std' | 'ext' | 'lrg' ",
			action: "One of: 'permit' | 'deny'",
			format: "One of: 'value' | 'list' | 'regexp',",
			value: "(depends on 'format'): Either the community value itself, a list of communities (sep by comma, e.g: '11:104,11:1111'), or the regexp expression",
			valueCount: "The number of actual values in 'value' - used when format is 'list'",
			_key_: "A unique string that defines the unique record in this dataset.  Format of 'deviceName:communityListType:communityListName'",
			skippedCols: "Reports any column names in this dataset that existed during final parsing, but dropped by the 'formatColumns' step of this module (could be intentional or unintentional)"
		},
	}



	/**************************************************************
	 * Standard (16-bit) Community List Section
	 **************************************************************/

	// 16-bit community value for current EOS versions
	const std_communityList_value = parseLine(
		'ip community-list',
		hword.tag('communityListName'),
		oneOf('permit', 'deny').tag('action'),
		many1(tok(std_community_value)).tagList('values'),
		rol.chain((res) => (res.trim().length > 0) ?
			succeedWith(res).logResult((res) => `DEVICE:'[${deviceName}]', MODULE:'${pmodule.name}', PARSER:'std_communityList_value']: unhandled text at end: '${res}'`)
			: succeedWith(null)
		)
	).getTaggedR()
		.map(({ communityListName, action, values, ...rest }) => ({
			communityListName,
			action,
			value: values.map(({ value }) => value).join(','),
			valueCount: `${values.length}`,
			format: values.length > 1 ? 'list' : 'value',
			...rest,
		}))

	// 16-bit community regex (asn mode regex - see note above) for current EOS versions
	const std_communityList_regex = parseLine(
		tok('ip community-list regexp'),
		hword.tag('communityListName'),
		oneOf('permit', 'deny').tag('action'),
		everythingUntil(eol).tag('value'),
		succeedWith('regexp').tag('format')
	).getTaggedR()



	// 16-bit catch-all parser for unrecognized patterns
	const std_community_list_UNK = parseLine(
		'ip community-list',
		hword.tag('communityListName'),
		oneOf('permit', 'deny').tag('action'),
		rol.tag('unhandled'),
	).getTaggedR()
		.logResult(({ communityListName, unhandled }) => `DEVICE:'[${deviceName}]', MODULE:'${pmodule.name}', PARSER:'std_communityList_UNK']: Uhandled parsing for '${communityListName}': '${unhandled}'`)


	// 16-bit catch-all parser for unrecognized patterns
	const std_community_list_INVALID = parseLine(
		'ip community-list',
		rol.tag('unhandled'),
	).getTaggedR()
		.logResult(({ communityListName, unhandled }) => `DEVICE:'[${deviceName}]', MODULE:'${pmodule.name}', PARSER:'std_communityList_UNK']: Invalid format found: '${unhandled}'`)


	// remember that order is important here - more specific first!
	const std_communityList_entry = oneOf(
		std_communityList_regex,
		std_communityList_value,
		std_community_list_UNK,
		std_community_list_INVALID,
	).map(addTag('communityListType', 'std'))



	/**************************************************************
	 * Large BGP Community List Section
	 **************************************************************/

	const lrg_communityList_value = parseLine(
		'ip large-community-list',
		hword.tag('communityListName'),
		oneOf('permit', 'deny').tag('action'),
		many1(tok(lrg_community_value)).tagList('values'),
		rol.chain((res) => (res.trim().length > 0) ?
			succeedWith(res).logResult((res) => `DEVICE:'[${deviceName}]', MODULE:'${pmodule.name}', PARSER:'lrg_communityList_value']: unhandled text at end: '${res}'`)
			: succeedWith(null)
		)
	).getTaggedR()
		.map(({ communityListName, action, values, ...rest }) => ({
			communityListName,
			action,
			value: values.map(({ value }) => value).join(','),
			valueCount: `${values.length}`,
			format: values.length > 1 ? 'list' : 'value',
			...rest,
		}))


	const lrg_communityList_regexp = parseLine(
		'ip large-community-list regexp',
		hword.tag('communityListName'),
		oneOf('permit', 'deny').tag('action'),
		everythingUntil(eol).tag('match_exp'),
		succeedWith('regexp').tag('format')
	).getTaggedR()


	// unmatched
	const lrg_communityList_UNK = parseLine(
		'ip large-community-list',
		hword.tag('communityListName'),
		oneOf('permit', 'deny').tag('action'),
		rol.tag('unhandled'),
	).getTaggedR()
		.logResult(({ communityListName, unhandled }) => `DEVICE:'[${deviceName}]', MODULE:'${pmodule.name}', PARSER:'lrg_communityList_UNK']: Uhandled parsing for '${communityListName}': '${unhandled}'`)



	const lrg_communityList_entry = oneOf(
		lrg_communityList_regexp,
		lrg_communityList_value,
		lrg_communityList_UNK,
	).map(addTag('communityListType', 'lrg'))


	/**************************************************************
	 * Extended Community List Section
	 **************************************************************/

	// 	rt asn:nn 			Route Target, as specified by autonomous system:number.	
	const ext_communityList_value = parseLine(
		'ip extcommunity-list',
		hword.tag('communityListName'),
		oneOf('permit', 'deny').tag('action'),
		many1(tok(ext_community_value)).tagList('values'),

		rol.chain( (res) => (res.trim().length > 0) ?
			succeedWith(res).logResult( (res) => `DEVICE:'[${deviceName}]', MODULE:'${pmodule.name}', PARSER:'ext_communityList_value']: unhandled text at end: '${res}'`)
			: succeedWith(null)
		)

		//everythingUntil(eol).logResult( (res) => `DEVICE:'[${deviceName}]', MODULE:'${pmodule.name}', PARSER:'ext_communityList_value']: unhandled text at end: '${res}'`),	
	).getTaggedR()
		.map(({ communityListName, action, values, ...rest }) => ({
			communityListName,
			action,
			value: values.map(({ value }) => value).join(','),
			valueCount: `${values.length}`,
			format: values.length > 1 ? 'list' : 'value',
			...rest,
		}))

	//	regex						
	const ext_communityList_regexp = parseLine(
		oneOf('permit', 'deny').tag('action'),
		everythingUntil(eol).tag('match_exp'),
	).getTaggedR()
		.map(addTag('format', 'regexp'))

	// unmatched
	const ext_communityList_UNK = parseLine(
		'ip extcommunity-list',
		hword.tag('communityListName'),
		oneOf('permit', 'deny').tag('action'),
		rol.tag('unhandled'),
	).getTaggedR()
		.logResult(({ communityListName, unhandled }) => `DEVICE:'[${deviceName}]', MODULE:'${pmodule.name}', PARSER:'ext_communityList_UNK']: Uhandled parsing for '${communityListName}': '${unhandled}'`)


	const ext_communityList_entry = oneOf(
		ext_communityList_value,
		ext_communityList_regexp,
		ext_communityList_UNK,
	).map(addTag('communityListType', 'ext'))




	/**************************************************************
	 * Final Processing Section
	 **************************************************************/

	const get_std_communityList_entries = possibly(lookAhead(
		seqOf(
			gotoSection('ip community-list'),
			many(std_communityList_entry).tag('std_communityList_entries')
		).getTagged()
			.map(multiplyBy_v2('std_communityList_entries'))
	)).map(nullToArray)

	const get_ext_communityList_entries = possibly(lookAhead(
		seqOf(
			gotoSection('ip extcommunity-list').ifError(`[get_ext_communityList_entries]: no 'ip extcommunity-list' statements found on device`),
			many(ext_communityList_entry).tag('ext_communityList_entries')
		).getTagged()
			.map(multiplyBy_v2('ext_communityList_entries'))
	)).map(nullToArray)

	const get_lrg_communityList_entries = possibly(lookAhead(
		seqOf(
			gotoSection('ip large-community-list').ifError(`[get_lrg_communityList_entries]: no 'ip large-community-list' statements found on device`),
			many(lrg_communityList_entry).tag('lrg_communityList_entries')
		).getTagged()
			.map(multiplyBy_v2('lrg_communityList_entries'))
	)).map(nullToArray)


	// type is 'standard', 'extended', or 'large' - needed only for fine-grained reporting in error log
	const filterOutDuplicateCommunityListNames = (type = '') => (results) => {
		const groupedResults = groupByPropName('communityListName')(results)
		const duplicateEntryNames = []
		const validEntries = []
		for (const communityListName in groupedResults) {
			if (groupedResults[communityListName].length !== 1) {
				const taintedRecords = groupedResults[communityListName].map(({ ...record }) => ({ ...record, format: 'duplicate' }))
				validEntries.push(taintedRecords)
				duplicateEntryNames.push(communityListName)
			}
			else {
				validEntries.push(groupedResults[communityListName])[0]
			}
		}

		// if duplicates, return the subset of results (validEntries) only
		if (duplicateEntryNames.length > 0) {
			return succeedWith(validEntries).log(`${deviceName}: [${pmodule.name}]: **POSSIBLE MISCONFIG: ${duplicateEntryNames.length} duplicated ${type} community-lists are configured.  The following records have the 'format' attribute tagged as "duplicate" in the results: ['${duplicateEntryNames.join(',')}']`)
		}
		return succeedWith(results)
	}

	// Note that the 'communityListName' record may not be unique per switch, but this parser assumes so (and so does the Xpress network)
	// Currently, this checks and drops the communityList if there is more than one instance
	const formatColumns = ({
		communityListName,
		communityListType,
		action,
		valueCount,
		format,
		value,
		unhandled,
		...skipped
	}) => ({
		deviceName,
		communityListName,
		communityListType,
		action,
		format,
		value,
		valueCount,
		_key_: `${deviceName}:${communityListType}:${communityListName}`,
		unhandled,
		skippedCols: Object.keys(skipped).length == 0 ? `` : ` (by ${pmodule.name}): ${(Object.keys(skipped)).join(',')}`,
	})


	return seqOf(
		get_std_communityList_entries
			.chain(filterOutDuplicateCommunityListNames('standard'))
			.map(flattenArray),
		get_ext_communityList_entries
			.chain(filterOutDuplicateCommunityListNames('extended'))
			.map(flattenArray),
		get_lrg_communityList_entries
			.chain(filterOutDuplicateCommunityListNames('large'))
			.map(flattenArray),
	).map(flattenArray)
		.map(mapArray(formatColumns))  // refine the column output  as defined by the above function formatResults
}



// uncomment these out when used in browser
// get_eoscfg_community_lists('test_device_name')



// comment export out when using in-browser
export {
	// community-list parser for EOS (the main parser)
	get_eoscfg_community_lists,

	// utility parsers that parse individual value formats (i.e. interface-level EVPN config, BGP config, route-targets, & route-maps)
	std_community_value,
	lrg_community_value,
	ext_community_value_as_asn,
	ext_community_value_as_ipaddr,
	ext_community_value_as_asdot,
	ext_community_value_other,
	ext_community_value,
}
