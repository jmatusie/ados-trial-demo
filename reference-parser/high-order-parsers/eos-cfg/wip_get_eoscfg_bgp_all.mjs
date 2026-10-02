/** NEXT-GEN BGP Peers
 * 
 * This is the parser for EOS BGP that was completely re-done, but was initially lost.
 * It has a lot of catchning up to do as such (in no particular order):
 * 
 *  - this should be converted to a proper function - i.e. (deviceName) => { ... }
 * 
 *  - integrate the BGP community parser module, instead of pasted code inside this module
 * 
 *  - the original output of this parser looks very correct, but is highly hierarchical and
 *    needs to be rolled up
 * 
 *  - the BGP peer-groups need to be resolved.  There is a mapFn_resolvePeers function that was
 *    previously used in the older parser, and re-pasted below for reference, but needs work to
 *    adapt the new output structure, and is paused for a later time.
 * 
 *  - this parser had to be fixed to skip over other bgp sections not starting with 'vrf', but
 *    'vlan', 'vpws', and more 'address-family evpn ...' stuff.  This required a few modifications
 *    such as the use of an indented parser to delimit the section.  
 * 
 *  - Because of the use of an intended parser, I dont' know if logging and .logResult works yet
 * 
 *  - Also, because I skipped over 'vlan', 'vpws', and 'address-family blah blah' sections, section
 *    handlers should be written to handle them.
 * 
 *  - this parser should serve as a base for other BGP parsers (maybe even trying to use similar
 *    structures for Nexus & IOS XR parsers ).  But the results can be post-processed and return
 *    various datasets such as:
 *      - 'bgpPeers' - resolved, rolled up, and properly including the local-AS for VRFs
 *      - 'bgp' - for global BGP config
 *      - 'evpn' - for EVPN-specific reporting
 *      - 'vpws' - for VPWS / pseudowire reporting
 * 
 *  - At the bottom, a copy of the pre-processed data structure is pasted to see how we can roll
 *    this up.  Maybe give it to someone to process it with Python
 * 
 */


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




/** mapFn_resolvePeers  
 * 
 *  @todo: must handle duplicate peering with (due to VRFs)
 *
 *	This is a very domain-specific function, used in a very specific context.  The function is a mapFn
 *  on a very specific result structure, and used to add bgp peer data from a bgpPeerIPs to a bgpPeerTemplate
 *  (peer-group) if there is one.  
 *
 *  Takes a list of real peers (with IPs), and for any of the peers that belong to a peer-grup, it adds the peer-group parameters to it.  
 * 	When both peer IP and peer-groups have the same parameter, the peer IP assumes priority.
 * 
 *  The complexity of this function stems from the flexibility of the CLI w/regards to peer-groups & peers, which this 
 *  parser has to match the intention.
 *  
 *  This function expects an object with two lists: peerTemplates and bgpPeers.  
 *    peerTemplates contains all BGP neighbor attributes for a peer group (peerIP is the peer group name)
 *    bgpPeers contains all BGP neighbor attriburtes for an actual peer (peerIP is an IP address string)
 *    bgpPeers can be broken into two sub-types: 
 *			1) those peers that do not belong to a peer-group (i.e. no template resolution needed)
 *			2) those peers that belong to a peer-group, and need to be further resolved by the supplied template
 *    Note that depending on the text, the parser may find a peer with an IP address that is both resolved and unresolved, 
 *    This would not happen if the parser were context-based (i.e. for each IP address, parse the rest of the record for that IP
 *    address with a sub-parser, until the next line no longer contains that IP address.  However, currently, the bgpPeer parser
 *    treats each line independently, so it cannot tell if a neighbor x.x.x.x peer group TEST and the following neighbor x.x.x.y remote-as 
 *    is the same neighbor or a different neighbor, so it collects the first as an 'unresolved' and the second (incorrectly) as 'resolved'
 *    because it didnn't realize the line above it was part of the same neighbor.
 *    
 *    Hence, for now, we need to look for duplicates between resolved and unresolved, and merge them.  Because of this,
 *    function objMerge was written, and to handle a custom handling of duplicate properties, so the better value does not get
 *    overwritten by a null, a plug-in for objMerge is written (propMerge1)
 *   
 *	Really, the bgpPeer parser may be better written as a monadic context-based parser.
 */
const mapFn_resolvePeers = ({ bgpPeerTemplates, bgpPeerIPs }) => {
	// create a lookup table for peers that reference peer-group templates
	const [resolvedPeerIPs, unresolvedPeerIPs] = bifurcateArray((bgpPeerIP) => bgpPeerIP.peerTemplate==null|| bgpPeerIP.peerTemplate=='') (bgpPeerIPs)

	// create caches to deal with the 3 different types of bgpPeer records
	const templateCache = new Map()
	const resolvedPeerCache = new Map()

	// build the templateCache from the supplied 'bgpPeerTemplates' list.
	bgpPeerTemplates.map((peerTemplate) => { templateCache.set(peerTemplate.templateName, peerTemplate) })

	// using the templateCache, resolve each bgpPeer in the unresolved list, by looking up the peer's peerGroup, and applying template attributes to them
	const newlyResolvedPeerIPs = unresolvedPeerIPs.map((unresolvedPeerIP) => ({
		...templateCache.get(unresolvedPeerIP.peerTemplate), 			// template data
		...unresolvedPeerIP, 																			// merge with unresolved data (these props replaced template props)
		peer_group_notes: 'resolved_by_mapFn_resolvePeers'				// change peerType for informational/troubleshooting purposes  
	}))

	// builds a resolved neighbor cache, where the key is the neighbor IP address (peer is an IP address string)
	// yes - .map is used and it should be for, but should be OK
	newlyResolvedPeerIPs.map((newlyResolvedPeerIP) => {
		resolvedPeerCache.set(newlyResolvedPeerIP.peerIP, newlyResolvedPeerIP)
	})

	// This is the part of the code that is messy, to handle for duplicate peer IPs between 'resolved', and 'unresolved'
	// add 'resolved' to the newResolved map.  There could be duplicates (which is why we're bothering with a Map data structure in the first place for ).
	resolvedPeerIPs.map((peer) => {
		if (resolvedPeerCache.has(peer.peerIP)) {
			const duplicatePeer = resolvedPeerCache.get(peer.peerIP)
			const fullyResolvedPeer = { ...duplicatePeer, ...peer }
			// const fullyResolvedPeer = objMerge(duplicatePeer, peer, propMerge1)
			resolvedPeerCache.set(peer.peerIP, fullyResolvedPeer)
		}
		else {
			resolvedPeerCache.set(peer.peerIP, peer)
		}
	})

	return [...resolvedPeerCache.values()]
}


// use with Array.prototype.flatMap - takes a vrf and returns a list of vrf records
const flattenVrfs_to_peers = (..._vrfs) => {
	const vrfs = _vrfs.flat()
	const vrfPeers = vrfs.map( ({
		vrf,
		bgpVrfProps: { routerid=`[flattenVrfs_to_peers]:none`, ...restof_bgpVrfProps	},
		bgpPeers = [],
		aggregateAddresses = [],
		redistributeConnected = [],
		redistributeStatic = [],
		...skipped_vrf_props
	}) => bgpPeers.flatMap( ({bgpPeer})=> ({
		vrf,
		...bgpPeer,
		...restof_bgpVrfProps,
		aggregateAddresses: JSON.stringify(aggregateAddresses),
		redistributeConnected: JSON.stringify(redistributeConnected),
		redistributeStatic: JSON.stringify(redistributeStatic),
		skipped_vrf_props: Object.keys(skipped_vrf_props).length == 0 ? `` : `[flattenVrfs_to_peers]: ${(Object.keys(skipped_vrf_props)).join(',')}`
	})
	))
}

const flatten_globalBGP = ({
	globalBGP: {
		asn, 
		has_asNotation, 
		routerid, 
		bgpUpdatePolicy,
		distance,
		bgpPeerTemplates = [],
		bgpPeerIPs = [],
		aggregateAddresses = [],
		redistributeConnected = [],
		redistributeStatic = [],
		...skipped_globalBGP_config
	},
	vrfs,
	...skipped_globalBGP_sections
}) => ({
	asn, 
	has_asNotation, 
	routerid, 
	bgpUpdatePolicy,
	distance,
	bgpPeerTemplates,			
	aggregateAddresses: JSON.stringify(aggregateAddresses),
	redistributeConnected: JSON.stringify(redistributeConnected),
	redistributeStatic: JSON.stringify(redistributeStatic),

	skipped_bgpProps: Object.keys(skipped_globalBGP_sections).length == 0 ? `` : `[flattenVrfs_to_peers]: ${(Object.keys(skipped_globalBGP_sections)).join(',')}`,
	skipped_bgpProps2: Object.keys(skipped_globalBGP_config).length == 0 ? `` : `[flattenVrfs_to_peers]: ${(Object.keys(skipped_globalBGP_config)).join(',')}`,

	globalPeers: bgpPeerIPs.map( ({...global_bgpPeerRecord}) => ( ({vrfName: 'default', ...global_bgpPeerRecord }) ) ),
	vrfPeers: vrfs.flatMap(flattenVrfs_to_peers),
	allPeers: [...vrfs.flatMap(flattenVrfs_to_peers), ...bgpPeerIPs.map( ({...global_bgpPeerRecord}) => ( ({vrfName: 'default', ...global_bgpPeerRecord }) ) ) ],
})

	
/*********************************************************************************
 * Module:      eos_cfg_bgp_all
 * Version:     3.0
 * Parameters:  <todo>
 * Output:      <todo>
 * 
 * Description: <todo>
 * Caveats:     <todo>
 * References:  <todo>
 */




const get_eoscfg_bgp_all = (deviceName) => {


	/** SECTION 0.5: external modules (can be replaced by real modules in node, but not in HTML **
	 * 
	 * Note: This is more of a 'pseudo-import' of what should be a real import of an actual model.  
	 * It's just code that is shamelessly copy/pasted from another module and inlined here because 
	 * there are no modules (yet) in the HTML-based version of the parser
	 * 
	 **/
	
	// parses bgp community values
	const module_bgp_community = () => {
		const pmodule = {
			name: 'bgp_community',	
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
		const rightValue	= digits						// all communities - right value (16 bits for standard, 32 bits for ext/large)
		const colon 			= ':'								// all communities - delimiter between fields
		const asplain		= digits							// large communities - the left field as as-plain ASN (32bit)
		const asdot	=	sequenceOf(digits, '.', digits).map( ([left, _, right]) => `${left}.${right}` )
	
		const digits_as32bit = regex( /^\d{1,10}/ )// 1 to 10 digits number - needs improvement
	
		const leftValueParser = oneOf(
			leftValue_asASN.map(addTag('format', 'asn')),
			leftValue_asIP.map(addTag('format', 'ip'))
		)
	
		const stdCommunityValue = regex( /^\d{1,5}:\d{1,5}/ ).named('stdCommunityValue')
		const extCommunityValue = sequenceOf(leftValueParser.tag('left'), ':', rightValue.tag('right')).named('extCommunityValue')
		const lrgCommunityValue = sequenceOf(digits_as32bit, ':', digits_as32bit, ':', digits_as32bit, ':' ).named('lrgCommunityValue')
	
		return {
			stdCommunityValue,
			extCommunityValue,
			lrgCommunityValue,
		}
	}  // end of module module_community
	
	const { extCommunityValue }= module_bgp_community()
	
	/** SECTION 1: module-level metadata ****/
	
	// module metadata
	const pmodule = {
		name: 'eos_cfg_bgp_all',	// used for module identification when using logging in this module (i.e. logResult(`[${pmodule.name}]: blah blah blah`)
		ver: 1.0,									// future capability
		usage: '',								// future capability to provide help (may not be used)
	}
	
	
	/** SECTION 2: very generic result-level helpers to make code more readable (arguably).  ****
	 * 
	 * These are candidates for possibly moving into an external module 
	 * 
	 */
	
	// get values out of results and make the code more readable
	const _0 = (arr) => arr[0]
	const _1 = (arr) => arr[1]
	const _2 = (arr) => arr[2]
	const _3 = (arr) => arr[3]
	const isTrue = (res) => true
	
	
	/** SECTION 3: Common token parsers ****
	 * 
	 * Note that some of these are simply existing very general parsers, renamed for semantics only
	 * If they need to be changed to more restrictive parsers, they can be done using the local name instead of replacing references
	 * througout the code
	 * 
	 */
	
	// NOTE: for peerGroupName, the use of this regex is important...
	// the 'getPeer_asTemplate' uses this to determines whether the peer after a 'neighbor' is a peer-group instead of a peer-IP
	const peerGroupName = regex(/^[a-zA-Z]+[a-zA-Z0-9_-]+/).named('peerGroupName')
	
	const eosName = regex(/^[a-zA-Z0-9_-]+/)   // generic alphanumeric (plus underscores and dashes) used for vrfNames, routeMap names, aclNames, etc
	const vrfName = eosName.named('vrfName')
	const routeMapName = eosName.named('routeMapName')
	
	const route_distinguisher_plain = sequenceOf( digits, ':', digits ).map( ([left, _, right]) => `${left}:${right}`)
	const route_distinguisher_asIP = sequenceOf( ipAddress, ':', digits ).map( ([left, _, right]) => `${left}:${right}`)
	const route_distinguisher = oneOf(
		route_distinguisher_plain,
		route_distinguisher_asIP,
	).named('route_distinguisher')
	
	
	const asdot	=	sequenceOf([digits, strng('.'), digits]).map( ([left, , right]) => `${left}.${right}` )
	const asplain = digits
	const asn = oneOf(asdot, asplain).named('asn')
	const timerSeconds = digits.named('timerSeconds')
	
	
	
	/** SECTION 4: per-line parsers related to BGP ***
 * 
 */
	
	// bgpMain record entries
	const asnNotation					= parseLine( 'bgp asn notation asdot' ).map( isTrue ).named('asnNotation')
	const routerID						= parseLine( 'router-id', ipUC ).map( _1 ).named('routerID')
	const clusterID						= parseLine( 'bgp cluster-id', ipUC ).map( _1 ).named('clusterID')
	const distance 						= parseLine( 'distance bgp', digits, digits, digits ).map( ([_,d1,d2,d3])=>`${d1}/${d2}/${d3}` ).named('distance')
	const maxPaths 						= parseLine( 'maximum-paths', digits.tag('limit'), 'ecmp', digits.tag('maxECMP')).named('maxPaths')
	const defaultTimers				= parseLine( 'timers bgp', rol).map( _1 ).map( (res)=>res.split(' ')).map(joinWith(':')).named('default_timers')
	const bgpMissingPolicy 		= parseLine( 'bgp missing-policy', rol).map(joinWith(' ')).named('bgpMissingPolicy')
	const bgpUpdatePolicy 		= parseLine( 'update', rol).map(joinWith(' ')).named('bgpUpdatePolicy')
	const bgpAddlPathsPolicy	= parseLine( 'bgp additional-paths', rol).map(joinWith(' ')).named('bgpAddlPathsPolicy') 
	
	// bgp generic list entries
	const network							= parseLine( 'network', ipNetwork_asObject, at_eol).map( _1 ).named('network')
	const network_plus				= parseLine( 'network', ipNetwork_asObject, rol).map( ([_, prefixObj, flags]) => ({...prefixObj, flags}) ) 
	const aggregate						= parseLine( 'aggregate-address', ipNetwork_asObject, at_eol).map( _1 ).named('aggregate')
	const aggregate_plus			= parseLine( 'aggregate-address', ipNetwork_asObject, 'attribute-map', routeMapName, rol).map( ([_, prefixObj, __, attributeMap, flags]) => ({...prefixObj, attributeMap, flags}) ) 
	const redistConnected 		= parseLine( 'redistribute connected', routeMapName).map( _1).named('redistConnected')
	const redistStatic 				= parseLine( 'redistribute static', routeMapName).map( _1).named('redistStatic')
	const redistOther 				= parseLine( 'redistribute', routeMapName, rol).map( _1).named('redistOther')
	
	// vrf list entries
	const rd 					= parseLine('rd', route_distinguisher ).map( _1).named('rd')
	const rt_import 	= parseLine(`route-target import vpn-ipv4`, extCommunityValue).map( _1).named('rt_import')
	const rt_export 	= parseLine(`route-target export vpn-ipv4`, extCommunityValue).map( _1).named('rt_export')
	const rt_import_routeMap = parseLine(`route-target import vpn-ipv4 route-map`, routeMapName).map( _1).named('rt_import_routeMap')
	const rt_export_routeMap = parseLine(`route-target export vpn-ipv4 route-map`, routeMapName).map( _1).named('rt_export_routeMap')
	
	// wildcard line-items to match anything not 
	const unknown 						= parseLine(rol).map( _0 ).named('unknown')
	
	
	// **parameterized** bgpPeer record entries (handle both neighbor IP and neighbor template (peer-group) parsing)
	// Note: these are functions parameterized by a generic peer ID 'peer', which can be an IP address (), or a string
	
	
	const peer_group = (peer) => parseLine('neighbor', peer, 'peer group').named('peer_group')
	const peerIP_peerGroup = (peer) => parseLine('neighbor', ipUC, 'peer group', hword ).map( _3 ).named('peerIP_peerGroup')
	
	// In use, supplied by a getPeer_asIP or getPeer_asTemplate parser, and chained via .chain(...)
	const peer_remoteAs 				= (peer) => parseLine('neighbor', peer, 'remote-as', asn).map( _3 ).named('peer_remoteAs')
	const peer_localAs 					= (peer) => parseLine('neighbor', peer, 'local-as', asn.tag('asn'), rol.tag('flags')).named('peer_localAs')
	const peer_removePrivateAS 	= (peer) => parseLine('neighbor', peer, 'remove-private-as', rol ).map( _3 ).named('peer_removePrivateAS')
	const peer_nextHopSelf 			= (peer) => parseLine('neighbor', peer, 'next-hop-self').map( isTrue ).named('peer_removePrivateAS')
	const peer_bfd 							= (peer) => parseLine('neighbor', peer, 'bfd').map( isTrue ).named('peer_bfd')
	const peer_desc 						= (peer) => parseLine('neighbor', peer, 'description', rol).map(_3,).named('desc')
	const peer_timers 					= (peer) => parseLine('neighbor', peer, 'timers', rol).map( _3 ).map( (res)=>res.split(' ')).map(joinWith(':')).named('peer_timers')
	const peer_routeMap_in 			= (peer) => parseLine('neighbor', peer, 'route-map', routeMapName, 'in').map( _3 ).named('peer_routeMap_in')
	const peer_routeMap_out 		= (peer) => parseLine('neighbor', peer, 'route-map', routeMapName, 'out').map( _3 ).named('peer_routeMap_out')
	const peer_password 				= (peer) => parseLine('neighbor', peer, `password`, digits, rol).map( isTrue ).named('peer_password')
	const peer_sendCommunity 		= (peer) => parseLine('neighbor', peer, 'send-community').map( isTrue ).named('peer_sendCommunity')
	const peer_sendExtCommunity = (peer) => parseLine('neighbor', peer, 'send-extcommunity').map( isTrue ).named('peer_sendExtCommunity')
	const peer_sendLrgCommunity = (peer) => parseLine('neighbor', peer, 'send-large-community').map( isTrue ).named('peer_sendLrgCommunity')
	const peer_maxRoutes 				= (peer) => parseLine('neighbor', peer, 'maximum-routes', digits.tag('limit'), rol.tag('policy')).named('peer_maxRoutes')
	const peer_isShut						= (peer) => parseLine('neighbor', peer, 'shutdown').map( isTrue ).named('peer_isShut')
	
	const enabled_peer_enforce_first_as = (peer) => parseLine('neighbor', peer, 'enforce-first-as').map( isTrue )
	const disabled_peer_enforce_first_as = (peer) => parseLine('no neighbor', peer, 'enforce-first-as').map( isTrue )
	
	const peer_unknown					= (peer) => parseLine('neighbor', peer, rol).map( _2 ).named('peer_unknown')
	const peer_noCommand				= (peer) => parseLine('no neighbor', peer, rol).map( _2 ).named('peer_disabled_flag')
	
	const redistributeConnected = parseLine( 'redistribute connected', 'route-map', routeMapName.tagAs('routeMapName') ).named('redistributeConnected')
	const redistributeStatic 		= parseLine( 'redistribute static', 'route-map', routeMapName.tagAs('routeMapName') ).named('redistributeStatic')
	
	// aggregate & redistirbutes are used in eosBGP
	const aggregateAddress = parseLine( 
		'aggregate-address', 
		ipNetwork_asObject.tagAs('aggAddr'), 
		possibly(strng('as-set')).map(addTag('has_asSet', true)),
		possibly(seqOf(
			strng('attribute-map'), 
			routeMapName
		)).map( _1 ).tagAs('attributeMap'),
		rol.logResult( (res) => `[module:${pmodule.name}, parser:aggregateAddress]: unrecognized text after 'attribute-map': '${res}'`)
	).getTagged()
		.map(flattenItemWith('->'))
		.named('aggregateAddress')
	
	
	
	/** SECTION 5: BGP record-level parsers **/
	
	
	/** bgpPeerTemplate record - complete record parser for a bgpPeer template (peer-group)
 * bgpPeerTemplate_header  - starts the record-level parser, and supplies context 
 *                           for the follow parsers (which in this case, must match the peerIP)
 * bgpPeerTemplate_entries - aggregates all bgpPeerIP data for a single peer
 */
	
	const bgpPeerTemplate_header = lookAhead(parseLine('neighbor', peerGroupName)).map( _1 ).named('bgpPeerTemplate_header')
	
	const bgpPeerTemplate_entries = (peerGroup) => seqOf(
		succeedWith(peerGroup).tag('templateName'),
		setOf(
			peer_group (peerGroup).tag('peerGroup2'),
			peer_remoteAs					 (peerGroup).tag('remoteAs'),
			peer_localAs 				   (peerGroup).tag('localAs'),
			peer_desc 					   (peerGroup).tag('desc'),
			peer_routeMap_in 		   (peerGroup).tag('routeMap_in'),
			peer_routeMap_out 	   (peerGroup).tag('routeMap_out'),
			peer_removePrivateAS   (peerGroup).tag('removePrivateAs'),
			peer_timers 				   (peerGroup).tag('timers'),
			peer_bfd 						   (peerGroup).tag('hasBFD'),
			peer_maxRoutes 			   (peerGroup).tag('maxRoutes'),
			peer_nextHopSelf 		   (peerGroup).tag('nextHopSelf'),
			peer_password 			   (peerGroup).tag('passwd'),
			peer_sendCommunity 	   (peerGroup).tag('has_sendCommunnity'),
			peer_sendExtCommunity  (peerGroup).tag('has_sendExtCommunnity'),
			peer_sendLrgCommunity  (peerGroup).tag('has_sendLrgCommunnity'),
			peer_isShut						 (peerGroup).tag('peer_isShut'),
			enabled_peer_enforce_first_as(peerGroup).tag('enable_peer_enforce_first_as'),
			disabled_peer_enforce_first_as(peerGroup).tag('disabled_peer_enforce_first_as'),
			peer_unknown					 (peerGroup).logResult( (res) => `[module:${pmodule.name}, parser:bgpPeerTemplate_entries]: unrecognized text '${res}'`)
		)).named('bgpPeerTemplate_entries') 
	
	const bgpPeerTemplate_record = bgpPeerTemplate_header.chain( bgpPeerTemplate_entries )
		.getTaggedR()
		.map(flattenItemWith('->'))
		.named('bgpPeerTemplate_record')
	
	
	/** bgpPeerIP record - complete record parser for a bgpPeer
 * bgpPeerIP_header  - starts the record-level parser, and supplies context 
 *                     for the follow parsers (which in this case, must match the peerIP)
 * bgpPeerIP_entries - aggregates all bgpPeerIP data for a single peer
 */
	
	const bgpPeerIP_header = lookAhead(parseLine('neighbor', ipAddress)).map( _1 ).named('bgpPeerIP_header')
	
	const bgpPeerIP_entries = (peerIP) => seqOf(
		succeedWith(peerIP).tag('peerIP'),
		setOf(
			peer_remoteAs					 (peerIP).tag('remoteAs').named('ra'),
			peer_localAs 				   (peerIP).tag('localAs'),
			peer_desc 					   (peerIP).tag('desc'),
			peer_routeMap_in 		   (peerIP).tag('routeMap_in'),
			peer_routeMap_out 	   (peerIP).tag('routeMap_out'),
			peer_removePrivateAS   (peerIP).tag('removePrivateAs'),
			peerIP_peerGroup       (peerIP).tag('peerTemplate'),
			peer_timers 				   (peerIP).tag('timers'),
			peer_bfd 						   (peerIP).tag('hasBFD'),
			peer_maxRoutes 			   (peerIP).tag('maxRoutes'),
			peer_nextHopSelf 		   (peerIP).tag('nextHopSelf'),
			peer_password 			   (peerIP).tag('passwd'),
			peer_sendCommunity 	   (peerIP).tag('has_sendCommunnity'),
			peer_sendExtCommunity  (peerIP).tag('has_sendExtCommunnity'),
			peer_sendLrgCommunity  (peerIP).tag('has_sendLrgCommunnity'),
			peer_isShut						 (peerIP).tag('peer_isShut'),
			enabled_peer_enforce_first_as(peerIP).tag('enable_peer_enforce_first_as'),
			disabled_peer_enforce_first_as(peerIP).tag('disabled_peer_enforce_first_as'),
			peer_noCommand				 (peerIP).logResult((res) => `[module:${pmodule.name}, parser:bgpPeerIP_entries]: unrecognized 'no' command for peer ${peerIP}: '${res}'`),
			peer_unknown					 (peerIP).logResult((res) => `[module:${pmodule.name}, parser:bgpPeerIP_entries]: unrecognized text '${res}'`)
		) 
	).named('bgpPeerIP_entries') 
	
	const bgpPeerIP_record = bgpPeerIP_header.chain( bgpPeerIP_entries )
		.getTaggedR()
		.map(flattenItemWith('->'))
		.named('bgpPeerIP_record')


	// start of bgpProcess records & vrfProcess records
	const bgpMain_header 	= parseLine( 'router bgp', asn ).map( _1 ).named('bgpMain_header')
	
	// collect individual prop items used in bgpMainRecord
	const bgpMain_entries = many( 
		except(oneOf(
		// these are how we know to stop processing bgpMainProps - when we hit one of these.
			regex(/^\s*neighbor /),
			regex(/^\s*network /),
			regex(/^\s*redistribute /),
			regex(/^\s*aggregate /),
			parseLine('!'),
		).named('bgpMain_entries_terminators'), oneOf(
			asnNotation.tag('has_asNotation'),
			routerID.tag('routerid'),
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
	const bgpMain_record =  parseSection(sequenceOf(
		bgpMain_header.tag('asn'),
		bgpMain_entries,
		many(bgpPeerTemplate_record).tagList('bgpPeerTemplates'),
		many(bgpPeerIP_record).tagList('bgpPeerIPs'),
		many(aggregateAddress).tagList('aggregateAddresses'),
		possibly(redistributeConnected.tag('redistributeConnected')),
		possibly(redistributeStatic.tag('redistributeStatic')),
	)).getTaggedR()


	const bgpVrf_header		= parseLine( 'vrf', vrfName ).map( _1 ).named('bgpVrf_header')
	
	
	// get lists of vrf route-targets
	const routeTarget = oneOf(
		rt_import.tag('rt-i'),
		rt_export.tag('rt-ex'),
		rt_import_routeMap.tag('rt-i'),
		rt_export_routeMap.tag('rt-ex'),
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
			rd.tag('route_distinguisher'),
			many1(routeTarget).tagList('rts'),
			routerID.tag('routerid'),
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
	const bgpVrf_record_orig = parseSection(sequenceOf(
		bgpVrf_header.tag('vrf'),
		bgpVrf_entries.tag('bgpVrfProps'),
		many(bgpPeerIP_record).tagList('bgpPeers'),
		many(aggregateAddress).tagList('aggregateAddresses'),
		possibly(redistributeConnected.tag('redistributeConnected')),
		possibly(redistributeStatic.tag('redistributeStatic')),	
	)).getTaggedR()
	
	// vrf parser (note: 'parseSection' is for text that terminates in a '!')
	const bgpVrf_record1 = sequenceOf(
		goto(/^\s*vrf/m),				// advanced past the 'vlan', 'vpws', and 'address-family' stuff (for now) and go right to VRFs.  We should be at the start of the vrf line...	
		parseSection(sequenceOf(
			goto(/^\s*vrf/),			//
			bgpVrf_header.tag('vrf'),
			bgpVrf_entries.tag('bgpVrfProps'),
			many(bgpPeerIP_record).tagList('bgpPeers'),
			many(aggregateAddress).tagList('aggregateAddresses'),
			possibly(redistributeConnected.tag('redistributeConnected')),
			possibly(redistributeStatic.tag('redistributeStatic')),	
		)
		)).getTaggedR()
	

	// vrf parser (note: 'parseSection' is for text that terminates in a '!')
	const bgpVrf_record2 = sequenceOf(
		goto(/^\s*vrf/m),				// advanced past the 'vlan', 'vpws', and 'address-family' stuff (for now) and go right to VRFs.  We should be at the start of the vrf line...
		until(endOfIndentLevel, sequenceOf(
			bgpVrf_header.tag('vrf'),
			bgpVrf_entries.tag('bgpVrfProps'),
			many(bgpPeerIP_record).tagList('bgpPeers'),
			many(aggregateAddress).tagList('aggregateAddresses'),
			possibly(redistributeConnected.tag('redistributeConnected')),
			possibly(redistributeStatic.tag('redistributeStatic')),	
		)),
		parseLine('!'),				// since we're not using 'parseSection', don't forget about the end of section delimiter
	).getTaggedR()
	
	// vrf parser (note: 'parseSection' is for text that terminates in a '!')
	const bgpVrf_record3 = sequenceOf(
		goto(/^\s*vrf/m),				// advance past everything (skipping over all 'vlan', 'vpws', and 'address-family' stuff for now) and go right to VRFs.  We should be at the start of the vrf line...

		until(endOfIndentLevel, sequenceOf(
			bgpVrf_header.tag('vrf'),
			bgpVrf_entries.tag('bgpVrfProps'),
			many(bgpPeerIP_record).tagList('bgpPeers'),
			many(aggregateAddress).tagList('aggregateAddresses'),
			possibly(redistributeConnected.tag('redistributeConnected')),
			possibly(redistributeStatic.tag('redistributeStatic')),	
		)),
		parseLine('!'),				// since we're not using 'parseSection', don't forget about the end of section delimiter
	).getTaggedR()
	
	// vrf parser (note: 'parseSection' is for text that terminates in a '!')
	const bgpVrf_record4 = sequenceOf(
		goto(/^\s*vrf/m),				// advance past everything (skipping over all 'vlan', 'vpws', and 'address-family' stuff for now) and go right to VRFs.  We should be at the start of the vrf line...

		until(endOfIndentLevel, sequenceOf(
			bgpVrf_header.tag('vrf'),
			bgpVrf_entries.tag('bgpVrfProps'),
			many(bgpPeerIP_record).tagList('bgpPeers'),
			many(aggregateAddress).tagList('aggregateAddresses'),
			possibly(redistributeConnected.tag('redistributeConnected')),
			possibly(redistributeStatic.tag('redistributeStatic')),	
		)),
		possibly(parseLine('!')),				// since we're not using 'parseSection', don't forget about the end of section delimiter
	).getTaggedR()
	

	// without using 'until', for easier testing
	const eosBGP =  sequenceOf(
		bgpMain_record.tag('globalBGP'),
		gotoStr('vrf'),
		many(bgpVrf_record4).tagList('vrfs'),
	).getTaggedR()

	// pull peerTemplates out from under global, and then combine global and vrf peers for a final list of peers
	//	.map( ({ 
	//		globalBGP: {
	//			asn,
	//			routerid,
	//			bgpPeerTemplates,
	//			bgpPeerIPs,
	//			aggregateAddresses,
	//			redistributeConnected,
	//			redistributeStatic,
	//			...skipped_globalBGP
	//		},
	//		vrfs,
	//		...skipped
	//	}) => ({
	//		asn,
	//		routerid,
	//		bgpPeerTemplates,
	//		bgpPeerIPs,
	//		aggregateAddresses,
	//		redistributeConnected,
	//		redistributeStatic,
	//		skippedCols1: Object.keys(skipped_globalBGP).length == 0 ? `` : `${(Object.keys(skipped)).join(',')}`,
	//		skippedCols2: Object.keys(skipped).length == 0 ? `` : `${(Object.keys(skipped)).join(',')}`,
	//		vrfs,
	//	}))



	const returnVal = sequenceOf(
		gotoSection('router bgp'),
		until(endOfIndentLevel, eosBGP),
	).map( _1 )
	// now the data is structured into bgpPeerTemplates and bgpPeers, resolve template data into peers
	// .map(mapFn_resolvePeers)



	return returnVal
}	


// uncomment when testing in-browser, comment in node.js
// get_eoscfg_bgp_all('mytestdevicename')


// comment out when testing in-browser, uncomment in node.js
export { get_eoscfg_bgp_all }

const vrfRecord = {
	"vrf": "XP-A",
	"bgpVrfProps": {
		"routerid": "10.117.30.1"
	},  // wtf
	"bgpPeers": [
		{
			"peerIP": "169.254.80.1",
			"remoteAs": "64203.1",
			"hasBFD": true,
			"desc": "LXH-103K-R53B01-R01",
			"timers": "3:9",
			"routeMap_in": "BGP-XPRESSXG-LXH-IN",
			"routeMap_out": "BGP-XPRESSXG-LXH-OUT",
			"has_sendCommunnity": true,
			"maxRoutes->limit": "12000",
			"maxRoutes->policy": "warning-limit 80 percent"
		},
		{
			"peerIP": "169.254.81.1",
			"remoteAs": "64522",
			"hasBFD": true,
			"desc": "NXPFRAEQ2TORC01",
			"timers": "3:9",
			"routeMap_in": "BGP-XPRESSXG-NXPFRAEQ2TORC01-IN",
			"routeMap_out": "BGP-XPRESSXG-NXPFRAEQ2TORC01-OUT",
			"has_sendCommunnity": true,
			"maxRoutes->limit": "12000",
			"maxRoutes->policy": "warning-limit 80 percent"
		},
		{
			"peerIP": "169.254.81.65",
			"remoteAs": "64205.2",
			"hasBFD": true,
			"desc": "FR2-1100-909-E01",
			"timers": "3:9",
			"routeMap_in": "BGP-XPRESSXG-FR2-E01-IN",
			"routeMap_out": "BGP-XPRESSXG-FR2-E01-OUT",
			"has_sendCommunnity": true,
			"maxRoutes->limit": "12000",
			"maxRoutes->policy": "warning-limit 80 percent"
		}
	],
	"aggregateAddresses": []
}




const sampleOutput = {
	"globalBGP": {
		"asn": "64205.1",
		"has_asNotation": true,
		"routerid": "10.117.30.1",
		"bgpUpdatePolicy": "update wait-install",
		"distance": "20/200/200",
		"max-paths": {
			"limit": "4",
			"maxECMP": "4"
		},
		"bgpPeerTemplates": [
			{
				"templateName": "EDGE",
				"hasBFD": true,
				"timers": "3:9",
				"routeMap_in": "BGP-EDGE-IN",
				"routeMap_out": "BGP-EDGE-OUT",
				"has_sendCommunnity": true,
				"maxRoutes->limit": "12000",
				"maxRoutes->policy": "warning-limit 80 percent"
			},
			{
				"templateName": "EVPN-GATEWAY",
				"desc": "eBGP (direct peer) to border edge switch",
				"has_sendCommunnity": true
			},
			{
				"templateName": "EVPN-POP",
				"hasBFD": true,
				"desc": "eBGP overlay to POP devices (gateway bypass)",
				"has_sendCommunnity": true
			},
			{
				"templateName": "OOB",
				"hasBFD": true,
				"timers": "3:9",
				"routeMap_in": "BGP-OOB-IN",
				"routeMap_out": "BGP-OOB-OUT",
				"has_sendCommunnity": true,
				"maxRoutes->limit": "12000",
				"maxRoutes->policy": "warning-limit 80 percent"
			},
			{
				"templateName": "PEER",
				"hasBFD": true,
				"timers": "3:9",
				"routeMap_in": "BGP-PEER-IN",
				"routeMap_out": "BGP-PEER-OUT",
				"has_sendCommunnity": true
			},
			{
				"templateName": "SPINE",
				"hasBFD": true,
				"timers": "3:9",
				"routeMap_in": "BGP-SPINE-IN",
				"routeMap_out": "BGP-SPINE-OUT",
				"has_sendCommunnity": true,
				"maxRoutes->limit": "12000",
				"maxRoutes->policy": "warning-limit 80 percent"
			},
			{
				"templateName": "WAN-EVPN-OVERLAY",
				"has_sendCommunnity": true
			}
		],
		"bgpPeerIPs": [
			{
				"peerIP": "169.254.64.219",
				"peerTemplate": "SPINE",
				"remoteAs": "65205.1",
				"desc": "FR2-1100-909-R02"
			},
			{
				"peerIP": "169.254.96.0",
				"remoteAs": "64205.6",
				"desc": "FR2-1100-909-S01",
				"peerTemplate": "SPINE"
			},
			{
				"peerIP": "169.254.96.10",
				"remoteAs": "64205.6",
				"desc": "FR2-1100-909-S02",
				"peerTemplate": "SPINE"
			},
			{
				"peerIP": "169.254.96.20",
				"remoteAs": "64205.6",
				"desc": "FR2-1100-909-S03",
				"peerTemplate": "SPINE"
			},
			{
				"peerIP": "169.254.96.30",
				"remoteAs": "64205.6",
				"desc": "FR2-1100-909-S04"
			},
			{
				"peerIP": "169.254.163.134",
				"remoteAs": "64203.1",
				"hasBFD": true,
				"desc": "LXH-103K-R53B01-R01",
				"routeMap_in": "BGP-WAN-LXH-R01-IN",
				"routeMap_out": "BGP-WAN-LXH-R01-OUT",
				"has_sendCommunnity": true
			},
			{
				"peerIP": "169.254.163.138",
				"remoteAs": "64522",
				"hasBFD": true,
				"desc": "NXPFRAEQ2BBJR01",
				"routeMap_in": "BGP-NXPFRAEQ2BBJR01-IN",
				"routeMap_out": "BGP-NXPFRAEQ2BBJR01-OUT",
				"has_sendCommunnity": true,
				"peerTemplate": "EDGE"
			},
			{
				"peerIP": "169.254.163.143",
				"remoteAs": "64205.2",
				"desc": "FR2-1100-909-E01",
				"peerTemplate": "WAN-EVPN-OVERLAY"
			},
			{
				"peerIP": "198.18.101.1",
				"remoteAs": "64201.1",
				"desc": "LD4-3350-203-R01",
				"peerTemplate": "WAN-EVPN-OVERLAY"
			},
			{
				"peerIP": "198.18.102.1",
				"remoteAs": "64202.1",
				"desc": "BAS-H1P14S-R01",
				"peerTemplate": "WAN-EVPN-OVERLAY"
			},
			{
				"peerIP": "198.18.103.1",
				"remoteAs": "64203.1",
				"desc": "LXH-103K-R53B01-R01",
				"peerTemplate": "WAN-EVPN-OVERLAY"
			},
			{
				"peerIP": "198.18.104.1",
				"remoteAs": "64204.1",
				"desc": "LDN-HS2F-BQ21-R01",
				"peerTemplate": "EVPN-POP"
			},
			{
				"peerIP": "198.18.105.12",
				"remoteAs": "65205.1",
				"desc": "FR2-1100-909-R02",
				"peerTemplate": "EVPN-POP"
			},
			{
				"peerIP": "198.18.105.21",
				"remoteAs": "64205.2",
				"desc": "FR2-1100-909-E01",
				"peerTemplate": "EVPN-POP"
			},
			{
				"peerIP": "198.18.105.22",
				"remoteAs": "65205.2",
				"desc": "FR2-1100-909-E02",
				"peerTemplate": "EVPN-POP"
			},
			{
				"peerIP": "198.18.105.23",
				"remoteAs": "64205.9",
				"desc": "FR2-1100-909-E03",
				"peerTemplate": "EVPN-POP"
			},
			{
				"peerIP": "198.18.105.24",
				"remoteAs": "65205.9",
				"desc": "FR2-1100-909-E04",
				"peerTemplate": "EVPN-POP"
			},
			{
				"peerIP": "198.18.105.25",
				"remoteAs": "64205.7",
				"desc": "FR2-1100-315-A01",
				"peerTemplate": "EVPN-POP"
			},
			{
				"peerIP": "198.18.105.26",
				"remoteAs": "65205.7",
				"desc": "FR2-1100-315-A02"
			}
		],
		"aggregateAddresses": [
			{
				"aggAddr->prefix": "10.117.30.0",
				"aggAddr->mask": "24",
				"attributeMap": "BGP-AGGREGATE-MGMT"
			},
			{
				"aggAddr->prefix": "10.117.31.0",
				"aggAddr->mask": "24",
				"attributeMap": "BGP-AGGREGATE-MGMT"
			},
			{
				"aggAddr->prefix": "10.117.30.0",
				"aggAddr->mask": "23",
				"attributeMap": "BGP-AGGREGATE-MGMT"
			}
		],
		"redistributeConnected": {
			"routeMapName": "CONNECTED-TO-BGP"
		},
		"redistributeStatic": {
			"routeMapName": "STATIC-TO-BGP"
		}
	},
	"vrfs": [
		{
			"vrf": "XP-A",
			"bgpVrfProps": {
				"routerid": "10.117.30.1"
			},
			"bgpPeers": [
				{
					"peerIP": "169.254.80.1",
					"remoteAs": "64203.1",
					"hasBFD": true,
					"desc": "LXH-103K-R53B01-R01",
					"timers": "3:9",
					"routeMap_in": "BGP-XPRESSXG-LXH-IN",
					"routeMap_out": "BGP-XPRESSXG-LXH-OUT",
					"has_sendCommunnity": true,
					"maxRoutes->limit": "12000",
					"maxRoutes->policy": "warning-limit 80 percent"
				},
				{
					"peerIP": "169.254.81.1",
					"remoteAs": "64522",
					"hasBFD": true,
					"desc": "NXPFRAEQ2TORC01",
					"timers": "3:9",
					"routeMap_in": "BGP-XPRESSXG-NXPFRAEQ2TORC01-IN",
					"routeMap_out": "BGP-XPRESSXG-NXPFRAEQ2TORC01-OUT",
					"has_sendCommunnity": true,
					"maxRoutes->limit": "12000",
					"maxRoutes->policy": "warning-limit 80 percent"
				},
				{
					"peerIP": "169.254.81.65",
					"remoteAs": "64205.2",
					"hasBFD": true,
					"desc": "FR2-1100-909-E01",
					"timers": "3:9",
					"routeMap_in": "BGP-XPRESSXG-FR2-E01-IN",
					"routeMap_out": "BGP-XPRESSXG-FR2-E01-OUT",
					"has_sendCommunnity": true,
					"maxRoutes->limit": "12000",
					"maxRoutes->policy": "warning-limit 80 percent"
				}
			],
			"aggregateAddresses": []
		},
		{
			"vrf": "cme-glink-a",
			"bgpVrfProps": {
				"routerid": "10.117.30.1"
			},
			"bgpPeers": [
				{
					"peerIP": "169.254.80.1",
					"remoteAs": "64203.1",
					"hasBFD": true,
					"desc": "LXH-103K-R53B01-R01",
					"timers": "3:9",
					"routeMap_in": "BGP-CME-LXH-IN",
					"routeMap_out": "BGP-CME-LXH-OUT",
					"has_sendCommunnity": true,
					"maxRoutes->limit": "12000",
					"maxRoutes->policy": "warning-limit 80 percent"
				},
				{
					"peerIP": "169.254.81.1",
					"remoteAs": "64522",
					"hasBFD": true,
					"desc": "NXPFRAEQ2TORC01",
					"timers": "3:9",
					"routeMap_in": "BGP-CME-NXPFRAEQ2TORC01-IN",
					"routeMap_out": "BGP-CME-NXPFRAEQ2TORC01-OUT",
					"has_sendCommunnity": true,
					"maxRoutes->limit": "12000",
					"maxRoutes->policy": "warning-limit 80 percent"
				},
				{
					"peerIP": "169.254.81.65",
					"remoteAs": "64205.2",
					"hasBFD": true,
					"desc": "FR2-1100-909-E01",
					"timers": "3:9",
					"routeMap_in": "BGP-CME-FR2-E01-IN",
					"routeMap_out": "BGP-CME-FR2-E01-OUT",
					"has_sendCommunnity": true,
					"maxRoutes->limit": "12000",
					"maxRoutes->policy": "warning-limit 80 percent"
				}
			],
			"aggregateAddresses": []
		},
		{
			"vrf": "eurex10g-a",
			"bgpVrfProps": {
				"routerid": "10.117.30.1"
			},
			"bgpPeers": [
				{
					"peerIP": "169.254.80.1",
					"remoteAs": "64203.1",
					"hasBFD": true,
					"desc": "LXH-103K-R53B01-R01",
					"timers": "3:9",
					"routeMap_in": "BGP-EUREX10G-LXH-IN",
					"routeMap_out": "BGP-EUREX10G-LXH-OUT",
					"has_sendCommunnity": true,
					"maxRoutes->limit": "12000",
					"maxRoutes->policy": "warning-limit 80 percent"
				},
				{
					"peerIP": "169.254.81.1",
					"remoteAs": "64522",
					"hasBFD": true,
					"desc": "NXPFRAEQ2TORC01",
					"timers": "3:9",
					"routeMap_in": "BGP-EUREX10G-NXPFRAEQ2TORC01-IN",
					"routeMap_out": "BGP-EUREX10G-NXPFRAEQ2TORC01-OUT",
					"has_sendCommunnity": true,
					"maxRoutes->limit": "12000",
					"maxRoutes->policy": "warning-limit 80 percent"
				},
				{
					"peerIP": "169.254.81.65",
					"remoteAs": "64205.2",
					"hasBFD": true,
					"desc": "FR2-1100-909-E01",
					"timers": "3:9",
					"routeMap_in": "BGP-EUREX10G-FR2-E01-IN",
					"routeMap_out": "BGP-EUREX10G-FR2-E01-OUT",
					"has_sendCommunnity": true,
					"maxRoutes->limit": "12000",
					"maxRoutes->policy": "warning-limit 80 percent"
				}
			],
			"aggregateAddresses": []
		},
		{
			"vrf": "eurex1g-a",
			"bgpVrfProps": {
				"routerid": "10.117.30.1"
			},
			"bgpPeers": [
				{
					"peerIP": "169.254.80.1",
					"remoteAs": "64203.1",
					"hasBFD": true,
					"desc": "LXH-103K-R53B01-R01",
					"timers": "3:9",
					"routeMap_in": "BGP-EUREX1G-LXH-IN",
					"routeMap_out": "BGP-EUREX1G-LXH-OUT",
					"has_sendCommunnity": true,
					"maxRoutes->limit": "12000",
					"maxRoutes->policy": "warning-limit 80 percent"
				},
				{
					"peerIP": "169.254.81.1",
					"remoteAs": "64522",
					"hasBFD": true,
					"desc": "NXPFRAEQ2TORC01",
					"timers": "3:9",
					"routeMap_in": "BGP-EUREX1G-NXPFRAEQ2TORC01-IN",
					"routeMap_out": "BGP-EUREX1G-NXPFRAEQ2TORC01-OUT",
					"has_sendCommunnity": true,
					"maxRoutes->limit": "12000",
					"maxRoutes->policy": "warning-limit 80 percent"
				}
			],
			"aggregateAddresses": []
		},
		{
			"vrf": "eurex1g-o",
			"bgpVrfProps": {
				"routerid": "10.117.30.1"
			},
			"bgpPeers": [
				{
					"peerIP": "169.254.80.1",
					"remoteAs": "64203.1",
					"hasBFD": true,
					"desc": "LXH-103K-R53B01-R01",
					"timers": "3:9",
					"routeMap_in": "BGP-EUREX1G-O-LXH-IN",
					"routeMap_out": "BGP-EUREX1G-O-LXH-OUT",
					"has_sendCommunnity": true,
					"maxRoutes->limit": "12000",
					"maxRoutes->policy": "warning-limit 80 percent"
				},
				{
					"peerIP": "169.254.80.65",
					"remoteAs": "65205.1",
					"hasBFD": true,
					"desc": "FR2-1100-909-R02",
					"timers": "3:9",
					"routeMap_in": "BGP-EUREX1G-O-PEER-IN",
					"routeMap_out": "BGP-EUREX1G-O-PEER-OUT",
					"has_sendCommunnity": true,
					"maxRoutes->limit": "12000",
					"maxRoutes->policy": "warning-limit 80 percent"
				},
				{
					"peerIP": "169.254.81.1",
					"remoteAs": "64522",
					"hasBFD": true,
					"desc": "NXPFRAEQ2TORC01",
					"timers": "3:9",
					"routeMap_in": "BGP-EUREX1G-O-NXPFRAEQ2TORC01-IN",
					"routeMap_out": "BGP-EUREX1G-O-NXPFRAEQ2TORC01-OUT",
					"has_sendCommunnity": true,
					"maxRoutes->limit": "12000",
					"maxRoutes->policy": "warning-limit 80 percent"
				}
			],
			"aggregateAddresses": []
		},
		{
			"vrf": "ice-us",
			"bgpVrfProps": {
				"routerid": "10.117.30.1"
			},
			"bgpPeers": [
				{
					"peerIP": "169.254.80.1",
					"remoteAs": "64203.1",
					"hasBFD": true,
					"desc": "LXH-103K-R53B01-R01",
					"timers": "3:9",
					"routeMap_in": "BGP-ICE-US-LXH-IN",
					"routeMap_out": "BGP-ICE-US-LXH-OUT",
					"has_sendCommunnity": true,
					"maxRoutes->limit": "12000",
					"maxRoutes->policy": "warning-limit 80 percent"
				},
				{
					"peerIP": "169.254.81.1",
					"remoteAs": "64522",
					"hasBFD": true,
					"desc": "NXPFRAEQ2TORC01",
					"timers": "3:9",
					"routeMap_in": "BGP-ICE-US-NXPFRAEQ2TORC01-IN",
					"routeMap_out": "BGP-ICE-US-NXPFRAEQ2TORC01-OUT",
					"has_sendCommunnity": true,
					"maxRoutes->limit": "12000",
					"maxRoutes->policy": "warning-limit 80 percent"
				}
			],
			"aggregateAddresses": []
		},
		{
			"vrf": "nva",
			"bgpVrfProps": {
				"route_distinguisher": "198.18.105.9:1",
				"routerid": "198.18.105.9"
			},
			"bgpPeers": [
				{
					"peerIP": "169.254.166.116",
					"remoteAs": "64522",
					"desc": "VRF-NVA-NXPFRAEQ2TORC01",
					"timers": "3:9",
					"routeMap_in": "BGP-NXPFRAEQ2TORC01-NVA-IN",
					"routeMap_out": "BGP-NXPFRAEQ2TORC01-NVA-OUT",
					"has_sendCommunnity": true,
					"maxRoutes->limit": "12000",
					"maxRoutes->policy": "warning-limit 80 percent"
				},
				{
					"peerIP": "172.30.213.14",
					"remoteAs": "64205.9",
					"desc": "VRF-NVA-FR2-1100-909-E03",
					"has_sendCommunnity": true,
					"maxRoutes->limit": "12000",
					"maxRoutes->policy": ""
				}
			],
			"aggregateAddresses": []
		},
		{
			"vrf": "xpress-cef-10g-a",
			"bgpVrfProps": {
				"routerid": "10.117.30.1"
			},
			"bgpPeers": [
				{
					"peerIP": "169.254.80.1",
					"remoteAs": "64203.1",
					"hasBFD": true,
					"desc": "LXH-103K-R53B01-R01",
					"timers": "3:9",
					"routeMap_in": "BGP-XPRESS-CEF-LXH-IN",
					"routeMap_out": "BGP-XPRESS-CEF-LXH-OUT",
					"has_sendCommunnity": true,
					"maxRoutes->limit": "12000",
					"maxRoutes->policy": "warning-limit 80 percent"
				},
				{
					"peerIP": "169.254.81.1",
					"remoteAs": "64522",
					"hasBFD": true,
					"desc": "NXPFRAEQ2TORC01",
					"timers": "3:9",
					"routeMap_in": "BGP-XPRESSXG-CEF-NXPFRAEQ2TORC01-IN",
					"routeMap_out": "BGP-XPRESSXG-CEF-NXPFRAEQ2TORC01-OUT",
					"has_sendCommunnity": true,
					"maxRoutes->limit": "12000",
					"maxRoutes->policy": "warning-limit 80 percent"
				},
				{
					"peerIP": "169.254.81.65",
					"remoteAs": "64205.2",
					"hasBFD": true,
					"desc": "FR2-1100-909-E01",
					"timers": "3:9",
					"routeMap_in": "BGP-XPRESSXG-CEF-FR2-E01-IN",
					"routeMap_out": "BGP-XPRESSXG-CEF-FR2-E01-OUT",
					"has_sendCommunnity": true,
					"maxRoutes->limit": "12000",
					"maxRoutes->policy": "warning-limit 80 percent"
				}
			],
			"aggregateAddresses": []
		}
	]
}













