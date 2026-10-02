const {
	dedent
} = await import("../dedent.mjs")


const {
	IPv4,
	RoutingTable,
	ASN,
	RDAP,
} = await import('../ClassIPv4.mjs')


const {
	pipe,
	flatMapArray,
	flattenArray,
	flattenArrayN,
	joinWith,
	mapArray,
	filterArray,

	addTag,

	flattenItem,
	flattenItemWith,
	flattenItemRecursively,
	flattenItemRecursivelyWith,
	groupByPropName,
	normalizedDataSet,

	nullToStr,
	nullToArray,
	nullToObject,
	ifNotFound,
	asString,
	asNumber,
	asBoolean,
	asArray,

	multiplyBy,
	multiplyByND,
	multiplyByZ,
	multiplyBy_v2,
	multiplyBy_v2_lossy,
	bifurcateArray,

	consolidate,
	consolidateBy,
	groupBy,
	intf_classifyBy,

	exportSwitchData,
	importSwitchData,
	is,
	match,


} = await import('../Parser_Result_Helpers.mjs')


const {
	Parser,
	strng,
	regex,
	sequenceOf,
	many,
	many1,
	succeedWith,
	everythingUntil,
	possibly,
	lookAhead,
	seqOf,
	oneOf,
	setOf,
	except,
	maybe,
	tok,
	coroutine,
	endOfInput,
	sepBy,
	sepBy1,
} = await import('../Parser_Core.mjs')


const {
	parseLine,
	digits,
	rol,
	hword,
	at_eol,
	word,
	eol,
	nbsp,		// 1 or more consequtive inline whitespace (spaces & tabs)
	_,			// 0 or more consequtive inline whitespace (spaces & tabs)
	__,			// 0 or more consequetive whitespace (spaces, tabs, newlines, carriage returns)
	letters,
	colon,
} = await import('../Parser_Text.mjs')


const {
	ipAddress,
	ipUC,
	ipMC,
	ipNetwork,
	ipNetworkOrAddress,
	ipNetwork_asObject,
	interfaceName,
	gotoSection,
	parseSection,
	parseSectionEOS,
	parseIndentedSectionEOS,
	hostnameFromConfig,
} = await import('../Parser_Network.mjs')


const {
	endOfIndentLevel,
	gotoStr,
	until,
	goto,
	untilStr,
	find,
} = await import('../Parser_FlexParser.mjs')


const {
	flexTable,
	strictTable,
	createTableParser,
} = await import('../Parser_Table.mjs')

export {
	// from Parser_Result_helpers.mjs
	pipe,

	flattenArray,
	flattenArrayN,
	flatMapArray,
	joinWith,
	mapArray,
	filterArray,
	addTag,
	flattenItem,
	flattenItemWith,
	flattenItemRecursively,
	flattenItemRecursivelyWith,
	groupByPropName,
	normalizedDataSet,
	nullToStr,
	nullToArray,
	nullToObject,
	ifNotFound,
	asString,
	asNumber,
	asBoolean,
	asArray,
	multiplyBy,
	multiplyByND,
	multiplyByZ,
	multiplyBy_v2,
	multiplyBy_v2_lossy,
	bifurcateArray,
	consolidate,
	consolidateBy,
	groupBy,
	intf_classifyBy,
	exportSwitchData,
	importSwitchData,
	is,
	match,


	// from Parser_Core.mjs
	Parser,
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
	maybe,
	tok,
	coroutine,
	endOfInput,
	sepBy,
	sepBy1,

	// from Parser_Text.mjs
	parseLine,
	digits,
	rol,
	hword,
	at_eol,
	word,
	eol,
	nbsp,		// 1 or more consequtive inline whitespace (spaces & tabs)
	_,			// 0 or more consequtive inline whitespace (spaces & tabs)
	__,			// 0 or more consequetive whitespace (spaces, tabs, newlines, carriage returns)
	letters,
	colon,

	// from Parser_Network.mjs
	ipAddress,
	ipUC,
	ipMC,
	ipNetwork,
	ipNetwork_asObject,
	ipNetworkOrAddress,
	interfaceName,
	gotoSection,
	parseSection,
	parseSectionEOS,
	parseIndentedSectionEOS,
	hostnameFromConfig,
	endOfIndentLevel,
	gotoStr,
	until,
	untilStr,
	goto,

	// from classIPv4.mjs
	IPv4,
	RoutingTable,
	ASN,
	RDAP,

	// from Parser_Table
	flexTable,
	strictTable,
	createTableParser,

	// from other:
	dedent,
	find,
}
