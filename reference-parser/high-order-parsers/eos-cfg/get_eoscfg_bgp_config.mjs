//NOTWORKING

/** NEXT-GEN BGP Peers
 * TODO 
 * 
 * - FIX route-targets - 
 * 
 *  - this parser had to be fixed to skip over other bgp sections not starting with 'vrf', but
 *    'vlan', 'vpws', and more 'address-family evpn ...' stuff.  This required a few modifications
 *    such as the use of an indented parser to delimit the section.  
 * 
 * TODO
 *  - Because of the use of an intended parser, I dont' know if logging and .logResult works yet
 * 
 * TODO
 *  - Also, because I skipped over 'vlan', 'vpws', and 'address-family blah blah' sections, section
 *    handlers should be written to handle them.
 * 
 * TODO
 *  - this parser should serve as a base for other BGP parsers (maybe even trying to use similar
 *    structures for Nexus & IOS XR parsers ).  But the results can be post-processed and return
 *    various datasets such as:
 *      - 'bgpPeers' - resolved, rolled up, and properly including the local-AS for VRFs
 *      - 'bgp' - for global BGP config
 *      - 'evpn' - for EVPN-specific reporting
 *      - 'vpws' - for VPWS / pseudowire reporting
 */


import {
	// from Parser_Result_helpers.mjs
	flattenArray,
	joinWith,
	mapArray,
	filterArray,
	multiplyBy,
	addTag,
	flattenItem,
	flattenItemWith,
	flattenItemRecursively,
	flattenItemRecursivelyWith,
	intf_classifyBy,
	normalizedDataSet,
	coroutine,
	nullToObject,
	nullToArray,
	nullToStr,
	groupBy,
	groupByPropName,
	bifurcateArray,

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
	word,
	eol,
	_,			// 0 or more consequtive inline whitespace (spaces & tabs)
	__,			// 0 or more consequetive whitespace (spaces, tabs, newlines, carriage returns)

	// from Parser_Network.mjs
	ipAddress,
	ipUC,
	ipMC,
	ipNetwork,
	ipNetwork_asObject,
	interfaceName,
	gotoSection,
	parseSection,
	hostnameFromConfig,
	endOfIndentLevel,
	gotoStr,
	until,
	goto,

	// from classIPv4.mjs
	IPv4,
	RoutingTable,
	ASN,

} from '../parser_modules.mjs'


import {
	std_community_value,
	lrg_community_value,
	ext_community_value_as_asn,
	ext_community_value_as_ipaddr,
	ext_community_value_as_asdot,
	ext_community_value_other,
	ext_community_value,
} from './get_eoscfg_community_lists.mjs'




/*********************************************************************************
 * Module:      get_eoscfg_bgp_config
 * Version:     3.0
 * Parameters:  <todo>
 * Output:      <todo>
 * 
 * Description: <todo>
 * Caveats:     <todo>
 * References:  <todo>
 */


const get_eoscfg_bgp_config = (deviceName) => {
	// parses bgp community values
	const module_bgp_community = () => {
		const pmodule = {
			name: 'get_eoscfg_bgp_config',
			ver: 1.0,
			usage: '',
		}

		/**************************************************************
		 * General/shared sub-line parsers / helpers
		 *
		 */
		// for extended communities
		const leftValue_asASN = digits				// extended community - 32-bit ASN for left left side (route-target, site-of-origin)
		const leftValue_asIP = ipAddress			// extended community - 32-bit ip address for left side (route-target, site-of-origin)
		const rightValue = digits						// all communities - right value (16 bits for standard, 32 bits for ext/large)
		const colon = ':'								// all communities - delimiter between fields
		const asplain = digits							// large communities - the left field as as-plain ASN (32bit)
		const asdot = sequenceOf(digits, '.', digits).map(([left, _, right]) => `${left}.${right}`)

		const digits_as32bit = regex(/^\d{1,10}/)// 1 to 10 digits number - needs improvement

		const leftValueParser = oneOf(
			leftValue_asASN.map(addTag('format', 'asn')),
			leftValue_asIP.map(addTag('format', 'ip'))
		)

		const stdCommunityValue = regex(/^\d{1,5}:\d{1,5}/).named('stdCommunityValue')
		//const extCommunityValue = sequenceOf(leftValueParser.tag('left'), ':', rightValue.tag('right')).named('extCommunityValue')
		const lrgCommunityValue = sequenceOf(digits_as32bit, ':', digits_as32bit, ':', digits_as32bit, ':').named('lrgCommunityValue')

		return {
			stdCommunityValue,
			extCommunityValue,
			lrgCommunityValue,
		}
	}  // end of module module_community

	const { extCommunityValue } = module_bgp_community()
	

	/** SECTION 1: module-level metadata ****/

	// module metadata
	const pmodule = {
		name: 'get_eos_cfgbgp_peers_v2',	// used for module identification when using logging in this module (i.e. logResult(`[${pmodule.name}]: blah blah blah`)
		ver: 1.0,									// future capability
		usage: '',								// future capability to provide help (may not be used)
	}


	// get values out of results and make the code more readable
	const _0 = (arr) => arr?.[0] ?? `ERROR:${_0}`
	const _1 = (arr) => arr?.[1] ?? `ERROR:${_1}`
	const _2 = (arr) => arr?.[2] ?? `ERROR:${_2}`
	const _3 = (arr) => arr?.[3] ?? `ERROR:${_3}`
	const isTrue = (res) => true


	/** SECTION 3: Common token parsers ****
	 * Note that some of these are simply existing very general parsers, renamed for semantics only
	 * If they need to be changed to more restrictive parsers, they can be done using the local name instead of replacing references
	 * througout the code
	 */

	// NOTE: for peerGroupName, the use of this regex is important...
	// the 'getPeer_asTemplate' uses this to determines whether the peer after a 'neighbor' is a peer-group instead of a peer-IP
	const peerGroupName = regex(/^[a-zA-Z]+[a-zA-Z0-9_-]+/).named('peerGroupName')

	const eosName = regex(/^[a-zA-Z0-9_-]+/)   // generic alphanumeric (plus underscores and dashes) used for vrfNames, routeMap names, aclNames, etc
	const vrfName = eosName.named('vrfName')
	const routeMapName = eosName.named('routeMapName')

	const route_distinguisher_plain = sequenceOf(digits, ':', digits).map(([left, _, right]) => `${left}:${right}`)
	const route_distinguisher_asIP = sequenceOf(ipAddress, ':', digits).map(([left, _, right]) => `${left}:${right}`)
	const route_distinguisher = oneOf(
		route_distinguisher_plain,
		route_distinguisher_asIP,
	).named('route_distinguisher')


	const asdot = sequenceOf([digits, strng('.'), digits]).map(([left, , right]) => `${left}.${right}`)
	const asplain = digits
	const asn = oneOf(asdot, asplain).named('asn')
	const timerSeconds = digits.named('timerSeconds')


	/** SECTION 4: per-line parsers related to BGP ***/

	// bgpMain record entries
	const asnNotation = parseLine('bgp asn notation asdot').map(isTrue).named('asnNotation')
	const routerID = parseLine('router-id', ipUC).map(_1).named('routerID')
	const clusterID = parseLine('bgp cluster-id', ipUC).map(_1).named('clusterID')
	const distance = parseLine('distance bgp', digits, digits, digits).map(([_, d1, d2, d3]) => `${d1}/${d2}/${d3}`).named('distance')
	const maxPaths = parseLine('maximum-paths', digits.tag('limit'), 'ecmp', digits.tag('maxECMP')).named('maxPaths')
	const defaultTimers = parseLine('timers bgp', rol).map(_1).map((res) => res.split(' ')).map(joinWith(':')).named('default_timers')
	const bgpMissingPolicy = parseLine('bgp missing-policy', rol).map(joinWith(' ')).named('bgpMissingPolicy')
	const bgpUpdatePolicy = parseLine('update', rol).map(joinWith(' ')).named('bgpUpdatePolicy')
	const bgpAddlPathsPolicy = parseLine('bgp additional-paths', rol).map(joinWith(' ')).named('bgpAddlPathsPolicy')

	// vrf list entries
	const rd = parseLine('rd', route_distinguisher).map(_1).named('rd')
	const rt_import = parseLine(`route-target import vpn-ipv4`, extCommunityValue).map(_1).named('rt_import')
	const rt_export = parseLine(`route-target export vpn-ipv4`, extCommunityValue).map(_1).named('rt_export')
	const rt_import_routeMap = parseLine(`route-target import vpn-ipv4 route-map`, routeMapName).map(_1).named('rt_import_routeMap')
	const rt_export_routeMap = parseLine(`route-target export vpn-ipv4 route-map`, routeMapName).map(_1).named('rt_export_routeMap')

	// wildcard line-items to match anything not 
	const unknown = parseLine(rol).map(_0).named('unknown')

	// **parameterized** bgpPeer record entries (handle both neighbor IP and neighbor template (peer-group) parsing)
	// Note: these are functions parameterized by a generic peer ID 'peer', which can be an IP address (), or a string

	const peer_group = (peer) => parseLine('neighbor', peer, 'peer group').named('peer_group')
	const peerIP_peerGroup = (peer) => parseLine('neighbor', peer, 'peer group', hword).map(_3).named('peerIP_peerGroup')

	// In use, supplied by a getPeer_asIP or getPeer_asTemplate parser, and chained via .chain(...)
	const peer_remoteAs = (peer) => parseLine('neighbor', peer, 'remote-as', asn).map(_3).named('peer_peerAS')
	//	const peer_localAs 					= (peer) => parseLine('neighbor', peer, 'local-as', asn.tag('asn'), rol.tag('flags')).named('peer_localAs')
	//const peer_localAs_v1 					= (peer) => parseLine('neighbor', peer, 'local-as', asn, rol).map( ([_, __, ___, asn, flags=``]) => `${asn} | ${flags.split(' ').join(' | ')}`)
	const peer_localAs = (peer) => parseLine('neighbor', peer, 'local-as', asn, rol).map(([_, __, ___, asn, flags = ``]) => ({ localAS: asn, localAS_flags: flags.split(' ').join('|') }))
	const peer_removePrivateAS = (peer) => parseLine('neighbor', peer, 'remove-private-as', rol).map(_3).named('peer_removePrivateAS')
	const peer_ebgpMultihop = (peer) => parseLine('neighbor', peer, 'ebgp-multihop', possibly(digits)).map(isTrue).named('peer_ebgpMultihop')
	const peer_nextHopSelf = (peer) => parseLine('neighbor', peer, 'next-hop-self').map(isTrue).named('peer_nextHopSelf')
	const peer_bfd = (peer) => parseLine('neighbor', peer, 'bfd').map(isTrue).named('peer_bfd')
	const peer_desc = (peer) => parseLine('neighbor', peer, 'description', rol).map(_3,).named('desc')
	const peer_timers = (peer) => parseLine('neighbor', peer, 'timers', rol).map(_3).map((res) => res.split(' ')).map(joinWith(':')).named('peer_timers')
	const peer_routeMap_in = (peer) => parseLine('neighbor', peer, 'route-map', routeMapName, 'in').map(_3).named('peer_routeMap_in')
	const peer_routeMap_out = (peer) => parseLine('neighbor', peer, 'route-map', routeMapName, 'out').map(_3).named('peer_routeMap_out')
	const peer_password = (peer) => parseLine('neighbor', peer, `password`, digits, rol).map(isTrue).named('peer_password')
	const peer_sendCommunity = (peer) => parseLine('neighbor', peer, 'send-community').map(isTrue).named('peer_sendCommunity')
	const peer_sendExtCommunity = (peer) => parseLine('neighbor', peer, 'send-extcommunity').map(isTrue).named('peer_sendExtCommunity')
	const peer_sendLrgCommunity = (peer) => parseLine('neighbor', peer, 'send-large-community').map(isTrue).named('peer_sendLrgCommunity')
	const peer_maxRoutes = (peer) => parseLine('neighbor', peer, 'maximum-routes', digits.tag('limit'), rol.tag('policy')).named('peer_maxRoutes')
	const peer_has_shutdown = (peer) => parseLine('neighbor', peer, 'shutdown').map(isTrue).named('is_shutdown')
	const peer_has_noshutdown = (peer) => parseLine('no neighbor', peer, 'shutdown').map(isTrue).named('is_shutdown')

	const enabled_peer_enforce_first_as = (peer) => parseLine('neighbor', peer, 'enforce-first-as').map(isTrue)
	const disabled_peer_enforce_first_as = (peer) => parseLine('no neighbor', peer, 'enforce-first-as').map(isTrue)

	const peer_unknown = (peer) => parseLine('neighbor', peer, rol).map(_2).named('peer_unknown')
	const peer_noCommand = (peer) => parseLine('no neighbor', peer, rol).map(_2).named('peer_disabled_flag')

	const redistributeConnected = parseLine('redistribute connected', possibly(routeMapName).map((res) => res ?? 'MISSING_ROUTE_MAP')).map(_1).named('redistributeConnected')
	const redistributeStatic = parseLine('redistribute static', possibly(routeMapName).map((res) => res ?? 'MISSING_ROUTE_MAP')).map(_1).named('redistributeStatic')

	// aggregate & redistirbutes are used in eosBGP
	const aggregateAddress = parseLine(
		'aggregate-address',
		ipNetwork_asObject.tag('aggAddr'),
		possibly(strng('as-set')).map(addTag('has_asSet', true)),
		possibly(seqOf(
			strng('attribute-map'),
			routeMapName
		)).map(_1).tag('attributeMap'),
		rol.logResult((res) => `[module:${pmodule.name}, parser:aggregateAddress]: unrecognized text after 'attribute-map': '${res}'`)
	).getTagged()
		.map(flattenItem)
		.named('aggregateAddress')



	/** SECTION 5: BGP record-level parsers **/


	/** bgpPeerTemplate record - complete record parser for a bgpPeer template (peer-group)
 * bgpPeerTemplate_header  - starts the record-level parser, and supplies context 
 *                           for the follow parsers (which in this case, must match the peerIP)
 * bgpPeerTemplate_entries - aggregates all bgpPeerIP data for a single peer
 */

	const bgpPeerTemplate_header = lookAhead(parseLine('neighbor', peerGroupName)).map(_1).named('bgpPeerTemplate_header')

	const bgpPeerTemplate_entries = (peerGroup) => seqOf(
		succeedWith(peerGroup).tag('templateName'),
		setOf(
			peer_group(peerGroup).tag('peerGroup'),
			peer_remoteAs(peerGroup).tag('peerAS'),
			peer_localAs(peerGroup).tag('localAS'),
			peer_desc(peerGroup).tag('desc'),
			peer_routeMap_in(peerGroup).tag('routeMap_in'),
			peer_routeMap_out(peerGroup).tag('routeMap_out'),
			peer_removePrivateAS(peerGroup).tag('removePrivateAS'),
			peer_ebgpMultihop(peerGroup).tag('is_ebgpMultihop'),
			peer_timers(peerGroup).tag('timers'),
			peer_bfd(peerGroup).tag('hasBFD'),
			peer_maxRoutes(peerGroup).tag('maxRoutes'),
			peer_nextHopSelf(peerGroup).tag('nextHopSelf'),
			peer_password(peerGroup).tag('peer_passwd'),
			peer_sendCommunity(peerGroup).tag('has_sendCommunity'),
			peer_sendExtCommunity(peerGroup).tag('has_sendExtCommunnity'),
			peer_sendLrgCommunity(peerGroup).tag('has_sendLrgCommunnity'),
			peer_has_shutdown(peerGroup).tag('is_shutdown'),
			enabled_peer_enforce_first_as(peerGroup).tag('enable_peer_enforce_first_as'),
			disabled_peer_enforce_first_as(peerGroup).tag('disabled_peer_enforce_first_as'),
			peer_unknown(peerGroup).logResult((res) => `[module:${pmodule.name}, parser:bgpPeerTemplate_entries]: unrecognized text '${res}'`)
		)).named('bgpPeerTemplate_entries')

	const bgpPeerTemplate_record = bgpPeerTemplate_header.chain(bgpPeerTemplate_entries)
		.getTaggedR()
		.map(flattenItem)
		.named('bgpPeerTemplate_record')


	/** bgpPeerIP record - complete record parser for a bgpPeer
 * bgpPeerIP_header  - starts the record-level parser, and supplies context 
 *                     for the follow parsers (which in this case, must match the peerIP)
 * bgpPeerIP_entries - aggregates all bgpPeerIP data for a single peer
 */

	const bgpPeerIP_header = lookAhead(parseLine(oneOf('neighbor', 'no neighbor'), ipAddress)).map(_1).named('bgpPeerIP_header')

	const bgpPeerIP_entries = (peerIP) => seqOf(
		succeedWith(peerIP).tag('peerIP'),
		setOf(
			peer_remoteAs(peerIP).tag('peerAS').named('ra'),
			peer_localAs(peerIP).tag('localAS'),
			peer_desc(peerIP).tag('desc'),
			peer_routeMap_in(peerIP).tag('routeMap_in'),
			peer_routeMap_out(peerIP).tag('routeMap_out'),
			peer_removePrivateAS(peerIP).tag('removePrivateAS'),
			peer_ebgpMultihop(peerIP).tag('is_ebgpMultihop').logResult('is_ebgpMulthop'),
			peerIP_peerGroup(peerIP).tag('peerGroup'),
			peer_timers(peerIP).tag('timers'),
			peer_bfd(peerIP).tag('hasBFD'),
			peer_maxRoutes(peerIP).tag('maxRoutes'),
			peer_nextHopSelf(peerIP).tag('nextHopSelf'),
			peer_password(peerIP).tag('peer_passwd'),
			peer_sendCommunity(peerIP).tag('has_sendCommunity'),
			peer_sendExtCommunity(peerIP).tag('has_sendExtCommunnity'),
			peer_sendLrgCommunity(peerIP).tag('has_sendLrgCommunnity'),
			peer_has_shutdown(peerIP).tag('is_shutdown'),
			peer_has_noshutdown(peerIP).tag('has_noshutdown'),
			enabled_peer_enforce_first_as(peerIP).tag('enable_peer_enforce_first_as'),
			disabled_peer_enforce_first_as(peerIP).tag('disabled_peer_enforce_first_as'),
			peer_noCommand(peerIP).logResult((res) => `[module:${pmodule.name}, parser:bgpPeerIP_entries]: unrecognized 'no' command for peer ${peerIP}: '${res}'`),
			peer_unknown(peerIP).logResult((res) => `[module:${pmodule.name}, parser:bgpPeerIP_entries]: unrecognized text '${res}'`)
		)
	).named('bgpPeerIP_entries')

	const bgpPeerIP_record = bgpPeerIP_header.chain(bgpPeerIP_entries)
		.getTaggedR()
		.map(flattenItem)
		.named('bgpPeerIP_record')


	// start of bgpProcess records & vrfProcess records
	const bgpMain_header = parseLine('router bgp', asn).map(_1).named('bgpMain_header')

	// collect individual prop items used in bgpMainRecord
	const bgpMain_entries = many(
		except(oneOf(
			// these are how we know to stop processing bgpMainProps - when we hit one of these.
			regex(/^\s*vrf /),
			regex(/^\s*neighbor /),
			regex(/^\s*network /),
			regex(/^\s*redistribute /),
			regex(/^\s*aggregate /),
			parseLine('!'),
		).named('bgpMain_entries_terminators'), oneOf(
			asnNotation.tag('has_asNotation'),
			routerID.tag('routerID'),
			distance.tag('distance'),
			maxPaths.tag('max-paths'),
			clusterID.tag('cluster-id'),
			defaultTimers.tag('default-timers'),
			bgpMissingPolicy.tag('bgpMissingPolicy'),
			bgpUpdatePolicy.tag('bgpUpdatePolicy'),
			bgpAddlPathsPolicy.tag('bgpAddlPathsPolicy'),
			unknown.logResult((res) => `[module:${pmodule.name}, parser:bgpMain_entries]: unrecognized text '${res}'`)
		).named('bgpMainProps_list')  // oneOf
		)
	).named('bgpMain_entries')


	// main routine  (note: 'parseSection' is for text that terminates in a '!')
	const bgpMain_record = sequenceOf(
		bgpMain_header.tag('deviceASN'),
		bgpMain_entries,
		many(bgpPeerTemplate_record).tagList('bgpPeerTemplates'),
		many(bgpPeerIP_record).tagList('bgpPeerIPs'),
		many(aggregateAddress).tagList('aggregateAddresses'),
		possibly(redistributeConnected.tag('redistributeConnected')),
		possibly(redistributeStatic.tag('redistributeStatic')),
	).getTaggedR()



	const bgpVrf_header = parseLine('vrf', vrfName).map(_1).named('bgpVrf_header')


	// get lists of vrf route-targets
	const routeTarget = oneOf(
		rt_import.tag('routeTargets_in'),
		rt_export.tag('routeTargets_out'),
		rt_import_routeMap.tag('routeTargets_in'),
		rt_export_routeMap.tag('routeTargets_out'),
	).named('routeTarget')


	// collect individual prop items used in bgpVrfRecord
	const bgpVrf_entries = many(
		except(oneOf(
			regex(/^\s*neighbor /),
			regex(/^\s*network /),
			regex(/^\s*redistribute /),
			regex(/^\s*aggregate /),
			parseLine('!'),
		).named('bgpVrf_entries_terminators'), oneOf(
			rd.tag('rd'),
			many1(routeTarget).tagList('routeTargets'),
			routerID.tag('routerID'),
			distance.tag('distance'),
			maxPaths.tag('max-paths'),
			clusterID.tag('cluster-id'),
			defaultTimers.tag('default-timers'),
			bgpMissingPolicy.tag('bgpMissingPolicy'),
			bgpUpdatePolicy.tag('bgpUpdatePolicy'),
			bgpAddlPathsPolicy.tag('bgpAddlPathsPolicy'),
			unknown.logResult((res) => `[module:${pmodule.name}, parser:bgpVrf_entries]: unrecognized text '${res}'`),
		))
	).named('bgpVrfProps')


	// vrf parser (note: 'parseSection' is for text that terminates in a '!')
	const bgpVrf_record = sequenceOf(
		goto(/^\s*vrf/m),				// advance past everything (skipping over all 'vlan', 'vpws', and 'address-family' stuff for now) and go right to VRFs.  We should be at the start of the vrf line...

		until(endOfIndentLevel, sequenceOf(
			bgpVrf_header.tag('vrfName'),
			bgpVrf_entries.tag('bgpVrfProps'),
			many(bgpPeerIP_record).tagList('bgpPeers'),
			many(aggregateAddress).tagList('aggregateAddresses'),
			possibly(redistributeConnected.tag('redistributeConnected')),
			possibly(redistributeStatic.tag('redistributeStatic')),
		)),
		possibly(parseLine('!')),				// since we're not using 'parseSection', don't forget about the end of section delimiter
	).getTaggedR()


	/*** OUTPUT FUNCTIONS ***/

	// Step 1 in the post-processing pipeline - just get the data to the right shape
	const toPeerRecords = ({
		globalBGP: {
			deviceASN = "really_handle_this",
			routerID = '',
			bgpPeerTemplates = [],
			bgpPeerIPs = [],
			aggregateAddresses = [],
			redistributeConnected,
			redistributeStatic,
			...skipped_globalBGP_config
		},
		vrfs = [],
	} = {}) => ({
		bgpPeerTemplates,
		global_bgpPeers: bgpPeerIPs.map((bgpPeer) => ({ vrfName: 'default', deviceASN, routerID, ...bgpPeer })),
		vrf_bgpPeers: vrfs.map(multiplyBy('bgpPeers')).flat().map(flattenItem).map((bgpPeer) => ({ deviceASN, ...bgpPeer })),
		bgpPeerIPs: [...bgpPeerIPs.map((bgpPeer) => ({ vrfName: 'default', deviceASN, routerID, ...bgpPeer })), ...vrfs.map(multiplyBy('bgpPeers')).flat().map(flattenItem).map((bgpPeer) => ({ deviceASN, ...bgpPeer }))]
	})


	// Step 2 - add a unique key to each record (by deviceName:vrfName:peerIP) because we are re-using BGP peer IPs across VRFs per device!!
	const addUniqueKey = ({ peerIP, vrfName, ...peer }) => ({
		_key_: `${deviceName}:${vrfName}:${peerIP}`,
		peerIP,
		vrfName,
		...peer
	})


	// Step 3 - resolve any peer IPs which reference a peer-group (it was important to have the unique key _key_ for this as well...)	
	const resolvePeers = ({ bgpPeerTemplates, bgpPeerIPs }) => {
		// split the peerIP records by whether they have a peerTemplate attribute or not - those that do require resolving
		const [resolvedPeerIPs, unresolvedPeerIPs] = bifurcateArray((bgpPeerIP) => bgpPeerIP.peerGroup == null || bgpPeerIP.peerGroup == '')(bgpPeerIPs)

		// create a template lookup database, keyed by templateName.  This will be used to iterate over unresolvedPeerIPs so we can add peer-group info to them
		const templateCache = new Map()
		bgpPeerTemplates.map((peerTemplate) => { templateCache.set(peerTemplate.templateName, peerTemplate) })

		// we're keeping track of peerIPs that are not peer-group members (thus resolved by default) and also those that we resolve via lookup
		const resolvedPeerCache = new Map()

		// using the templateCache, resolve each bgpPeer in the unresolved list, by looking up the peer's peerGroup, and applying template attributes to them
		const newlyResolvedPeerIPs = unresolvedPeerIPs.map((unresolvedPeerIP) => ({
			...templateCache.get(unresolvedPeerIP.peerGroup), 			// retrieve the peer-group data for the peerIP...
			...unresolvedPeerIP, 																			// merge with unresolved data (these props replaced template props)
			peerGroup_notes: 'resolved_by_mapFn_resolvePeers'				// change peerType for informational/troubleshooting purposes  
		}))

		// builds a resolved neighbor cache, where the key is the neighbor IP address (peer is an IP address string)
		// yes - .map is used and it should be for, but should be OK
		newlyResolvedPeerIPs.map((newlyResolvedPeerIP) => {
			resolvedPeerCache.set(newlyResolvedPeerIP._key_, newlyResolvedPeerIP)
		})

		// This is the part of the code that is messy, to handle for duplicate peer IPs between 'resolved', and 'unresolved'
		// add 'resolved' to the newResolved map.  There could be duplicates (which is why we're bothering with a Map data structure in the first place for ).
		resolvedPeerIPs.map((peer) => {
			if (resolvedPeerCache.has(peer._key_)) {
				const duplicatePeer = resolvedPeerCache.get(peer._key_)
				const fullyResolvedPeer = { ...duplicatePeer, ...peer }
				resolvedPeerCache.set(peer._key_, fullyResolvedPeer)
			}
			else {
				resolvedPeerCache.set(peer._key_, peer)
			}
		})
		return [...resolvedPeerCache.values()]
	}


	// Step 4: normalize ASNs to asplain, because we will use ASNs to map devices
	const normalizedASN = (asn = '') => asn.includes('.') ? `${(ASN.from_asDot(asn).error || ASN.from_asDot(asn).asn)}` : asn
	const normalizedASNs = ({
		deviceASN,
		peerAS,
		localAS,
		...bgpPeerRecord
	}) => ({
		deviceASN,
		peerAS,
		localAS,
		deviceASN_asplain: normalizedASN(deviceASN),
		peerAS_asplain: normalizedASN(peerAS),
		localAS_asplain: normalizedASN(localAS),
		...bgpPeerRecord,
	})


	// step 5 - reorder, add, drop, or rename any columns as needed...
	const formatColumns = ({
		vrfName,
		peerIP,
		is_shutdown,
		has_noshutdown,
		deviceASN,
		peerAS,
		localAS,
		localAS_flags,
		routeMap_in,
		routeMap_out,
		has_sendCommunity,
		routerID,
		rd,
		desc,
		peerGroup_notes,
		peerGroup,
		aggregateAddresses,
		redistributeConnected,
		redistributeStatic,
		deviceASN_asplain,
		peerAS_asplain,
		localAS_asplain,
		routeTargets_in,
		routeTargets_out,
		templateName,
		hasBFD,
		timers,
		maxRoutes__limit,
		maxRoutes__policy,
		bgpUpdatePolicy,
		bgpMissingPolicy,
		bgpAddlPathsPolicy,
		limit,
		policy,
		routeTargets,
		nextHopSelf,
		bgpVrfProps,
		removePrivateAS,
		is_ebgpMultihop,
		peer_passwd = false,
		_key_,
		...skipped
	}) => ({
		deviceName,
		vrfName,
		peerIP,
		peerType: (deviceASN == peerAS) ? 'iBGP' : 'eBGP',
		adminDown: (is_shutdown) ? true : (has_noshutdown) ? false : false,
		deviceASN,
		peerAS,
		localAS,
		localAS_flags,
		is_ebgpMultihop,
		routeMap_in,
		routeMap_out,
		has_sendCommunity,
		routerID,
		rd,
		desc,
		peerGroup,
		//	aggregateAddresses,
		//	redistributeConnected,
		//	redistributeStatic,
		deviceASN_asplain,
		peerAS_asplain,
		localAS_asplain,
		// routeTargets_in,
		// routeTargets_out,

		// routeTargets: JSON.stringify(routeTargets),

		//		templateName,
		//		hasBFD,
		//		timers,
		//		maxRoutes__limit,
		//		maxRoutes__policy,
		hasPassword: (peer_passwd==true) ? true : false,
		nextHopSelf,
		removePrivateAS,
		bgpVrfProps,
		_key_,
		skippedCols: Object.keys(skipped).length == 0 ? `` : ` (by ${pmodule.name}): ${(Object.keys(skipped)).join(',')}`
	})


	// putting it all together
	const returnVal = sequenceOf(
		gotoSection('router bgp'),
		until(endOfIndentLevel, sequenceOf(
			bgpMain_record.tag('globalBGP'),
			possibly(sequenceOf(
				gotoStr('vrf'),
				many(bgpVrf_record).tagList('vrfs'),
			))
		)),
	).getTaggedR()
		.named('get_eoscfg_bgp_config')
		.map(toPeerRecords)
		.map(({ bgpPeerIPs, ...rest }) => ({ bgpPeerIPs: bgpPeerIPs.map(addUniqueKey), ...rest }))
		.map(resolvePeers)
		.map(mapArray(normalizedASNs))
		.map(mapArray(formatColumns))
		.map(filterArray((bgpPeer) => bgpPeer?.peerIP != null && bgpPeer?.peerIP?.length != 0))

	return returnVal
}



// uncomment when testing in-browser, comment in node.js
// get_eoscfg_bgp_config('mytestdevicename')




// uncomment when testing in-browser, comment in node.js
//	get_eoscfg_bgp_config('mytestdevicename')


// comment out when testing in-browser, uncomment in node.js
export { get_eoscfg_bgp_config }

